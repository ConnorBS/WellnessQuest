from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_ha_token, get_db
from app.models.streak import Streak
from app.models.user import User
from app.schemas.water import WaterAddIn, WaterAddOut, WaterEntryOut, WaterTodayOut
from app.services import goal_service, water_service
from app.services.time_utils import day_for_user
from app.telemetry.recorder import audit

router = APIRouter(prefix="/ha", tags=["home-assistant"])


@router.get("/water/today", response_model=WaterTodayOut)
async def ha_water_today(
    user: User = Depends(current_ha_token("water:read")),
    db: AsyncSession = Depends(get_db),
) -> WaterTodayOut:
    goal = await goal_service.get_or_create_default_water(db, user_id=user.id)
    total = await water_service.total_today(db, user=user)
    goal_ml = int(goal.target)
    pct = min(100, round((total / goal_ml) * 100)) if goal_ml else 0
    return WaterTodayOut(
        date=day_for_user(user.timezone).isoformat(),
        total_ml=total,
        goal_ml=goal_ml,
        percent=pct,
        entries=[],  # HA only needs the rollup
    )


@router.post("/water/add", response_model=WaterAddOut, status_code=status.HTTP_201_CREATED)
async def ha_add_water(
    payload: WaterAddIn,
    request: Request,
    user: User = Depends(current_ha_token("water:write")),
    db: AsyncSession = Depends(get_db),
) -> WaterAddOut:
    result = await water_service.add(
        db,
        user=user,
        ml=payload.ml,
        source="ha",
        client_id=payload.client_id,
        occurred_at=payload.occurred_at,
        name=payload.name,
    )
    await audit(
        db,
        actor=f"ha:{request.state.api_token_id}",
        action="water.add",
        user_id=user.id,
        target_type="water_entry",
        target_id=str(result.entry.id),
        meta={
            "ml": payload.ml,
            "source": "ha",
            "client_id": payload.client_id,
            "name": payload.name,
        },
    )
    return WaterAddOut(
        entry=WaterEntryOut(
            id=result.entry.id,
            ml=result.entry.ml,
            source=result.entry.source,
            occurred_at=result.entry.occurred_at,
            client_id=result.entry.client_id,
            name=result.entry.name,
        ),
        total_ml=result.total_ml,
        goal_ml=result.goal_ml,
        xp_delta=result.xp_delta,
        goal_met=result.goal_met,
    )


@router.get("/me/stats")
async def ha_my_stats(
    user: User = Depends(current_ha_token("water:read")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    streaks = (
        await db.execute(select(Streak).where(Streak.user_id == user.id))
    ).scalars().all()
    return {
        "xp_total": user.xp_total,
        "level": user.level,
        "streaks": {
            s.metric: {"current": s.current_len, "longest": s.longest_len} for s in streaks
        },
    }
