from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.user import User
from app.schemas.water import WaterAddIn, WaterAddOut, WaterEntryOut, WaterTodayOut
from app.services import goal_service, water_service
from app.services.time_utils import day_for_user
from app.telemetry.recorder import audit

router = APIRouter(prefix="/water", tags=["water"])


@router.get("/today", response_model=WaterTodayOut)
async def water_today(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> WaterTodayOut:
    goal = await goal_service.get_or_create_default_water(db, user_id=user.id)
    total = await water_service.total_today(db, user=user)
    entries = await water_service.list_today(db, user=user)
    goal_ml = int(goal.target)
    pct = min(100, round((total / goal_ml) * 100)) if goal_ml else 0
    return WaterTodayOut(
        date=day_for_user(user.timezone).isoformat(),
        total_ml=total,
        goal_ml=goal_ml,
        percent=pct,
        entries=[
            WaterEntryOut(
                id=e.id, ml=e.ml, source=e.source, occurred_at=e.occurred_at, client_id=e.client_id
            )
            for e in entries
        ],
    )


@router.post("", response_model=WaterAddOut, status_code=status.HTTP_201_CREATED)
async def add_water(
    payload: WaterAddIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> WaterAddOut:
    result = await water_service.add(
        db,
        user=user,
        ml=payload.ml,
        source="pwa",
        client_id=payload.client_id,
        occurred_at=payload.occurred_at,
    )
    await audit(
        db,
        actor=f"user:{user.id}",
        action="water.add",
        user_id=user.id,
        target_type="water_entry",
        target_id=str(result.entry.id),
        meta={"ml": payload.ml, "source": "pwa", "client_id": payload.client_id},
    )
    return WaterAddOut(
        entry=WaterEntryOut(
            id=result.entry.id,
            ml=result.entry.ml,
            source=result.entry.source,
            occurred_at=result.entry.occurred_at,
            client_id=result.entry.client_id,
        ),
        total_ml=result.total_ml,
        goal_ml=result.goal_ml,
        xp_delta=result.xp_delta,
        goal_met=result.goal_met,
    )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_water(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await water_service.delete(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="water.delete",
        user_id=user.id,
        target_type="water_entry",
        target_id=str(entry_id),
    )
