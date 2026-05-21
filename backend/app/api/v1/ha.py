from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_ha_token, get_db
from app.models.streak import Streak
from app.models.user import User
from app.schemas.sleep import SleepAddIn, SleepAddOut, SleepEntryOut, SleepLastOut
from app.schemas.steps import StepsAddIn, StepsAddOut, StepsEntryOut, StepsTodayOut
from app.schemas.water import WaterAddIn, WaterAddOut, WaterEntryOut, WaterTodayOut
from app.services import goal_service, sleep_service, steps_service, water_service
from app.services.time_utils import day_for_user
from app.telemetry.recorder import audit

router = APIRouter(prefix="/ha", tags=["home-assistant"])


# --- Water ----------------------------------------------------------------


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
        entries=[],
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


# --- Steps ----------------------------------------------------------------


@router.get("/steps/today", response_model=StepsTodayOut)
async def ha_steps_today(
    user: User = Depends(current_ha_token("steps:read")),
    db: AsyncSession = Depends(get_db),
) -> StepsTodayOut:
    goal = await goal_service.get_or_create_default_steps(db, user_id=user.id)
    total = await steps_service.total_today(db, user=user)
    goal_target = int(goal.target)
    pct = min(100, round((total / goal_target) * 100)) if goal_target else 0
    return StepsTodayOut(
        date=day_for_user(user.timezone).isoformat(),
        total=total,
        goal=goal_target,
        percent=pct,
    )


@router.post("/steps/add", response_model=StepsAddOut, status_code=status.HTTP_201_CREATED)
async def ha_add_steps(
    payload: StepsAddIn,
    request: Request,
    user: User = Depends(current_ha_token("steps:write")),
    db: AsyncSession = Depends(get_db),
) -> StepsAddOut:
    result = await steps_service.add(
        db,
        user=user,
        count=payload.count,
        source="ha",
        client_id=payload.client_id,
        occurred_at=payload.occurred_at,
    )
    await audit(
        db,
        actor=f"ha:{request.state.api_token_id}",
        action="steps.add",
        user_id=user.id,
        target_type="steps_entry",
        target_id=str(result.entry.id),
        meta={"count": payload.count, "source": "ha", "client_id": payload.client_id},
    )
    return StepsAddOut(
        entry=StepsEntryOut(
            id=result.entry.id,
            count=result.entry.count,
            source=result.entry.source,
            occurred_at=result.entry.occurred_at,
            client_id=result.entry.client_id,
        ),
        total=result.total,
        goal=result.goal,
        xp_delta=result.xp_delta,
        goal_met=result.goal_met,
    )


# --- Sleep ----------------------------------------------------------------


@router.get("/sleep/last", response_model=SleepLastOut)
async def ha_sleep_last(
    user: User = Depends(current_ha_token("sleep:read")),
    db: AsyncSession = Depends(get_db),
) -> SleepLastOut:
    goal = await goal_service.get_or_create_default_sleep(db, user_id=user.id)
    entry = await sleep_service.last_session(db, user=user)
    return SleepLastOut(
        entry=(
            SleepEntryOut(
                id=entry.id,
                started_at=entry.started_at,
                ended_at=entry.ended_at,
                duration_minutes=entry.duration_minutes,
                quality_score=entry.quality_score,
                source=entry.source,
                client_id=entry.client_id,
            )
            if entry is not None
            else None
        ),
        goal_minutes=int(goal.target),
    )


@router.post("/sleep/add", response_model=SleepAddOut, status_code=status.HTTP_201_CREATED)
async def ha_add_sleep(
    payload: SleepAddIn,
    request: Request,
    user: User = Depends(current_ha_token("sleep:write")),
    db: AsyncSession = Depends(get_db),
) -> SleepAddOut:
    result = await sleep_service.add(
        db,
        user=user,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        source="ha",
        client_id=payload.client_id,
        quality_score=payload.quality_score,
    )
    await audit(
        db,
        actor=f"ha:{request.state.api_token_id}",
        action="sleep.add",
        user_id=user.id,
        target_type="sleep_entry",
        target_id=str(result.entry.id),
        meta={
            "duration_minutes": result.entry.duration_minutes,
            "quality_score": payload.quality_score,
            "client_id": payload.client_id,
        },
    )
    return SleepAddOut(
        entry=SleepEntryOut(
            id=result.entry.id,
            started_at=result.entry.started_at,
            ended_at=result.entry.ended_at,
            duration_minutes=result.entry.duration_minutes,
            quality_score=result.entry.quality_score,
            source=result.entry.source,
            client_id=result.entry.client_id,
        ),
        goal_minutes=result.goal_minutes,
        xp_delta=result.xp_delta,
        goal_met=result.goal_met,
    )


# --- Rollup --------------------------------------------------------------


@router.get("/me/stats")
async def ha_my_stats(
    user: User = Depends(current_ha_token("me:read")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    streaks = (
        await db.execute(select(Streak).where(Streak.user_id == user.id))
    ).scalars().all()

    water_goal = await goal_service.get_or_create_default_water(db, user_id=user.id)
    water_total = await water_service.total_today(db, user=user)
    water_goal_ml = int(water_goal.target)
    water_pct = min(100, round((water_total / water_goal_ml) * 100)) if water_goal_ml else 0

    steps_goal = await goal_service.get_or_create_default_steps(db, user_id=user.id)
    steps_total = await steps_service.total_today(db, user=user)
    steps_target = int(steps_goal.target)
    steps_pct = min(100, round((steps_total / steps_target) * 100)) if steps_target else 0

    sleep_goal = await goal_service.get_or_create_default_sleep(db, user_id=user.id)
    sleep_entry = await sleep_service.last_session(db, user=user)
    sleep_block: dict[str, object] | None = None
    if sleep_entry is not None:
        sleep_block = {
            "duration_minutes": sleep_entry.duration_minutes,
            "quality_score": sleep_entry.quality_score,
            "ended_at": sleep_entry.ended_at.isoformat(),
            "goal_met": sleep_entry.duration_minutes >= int(sleep_goal.target),
        }

    return {
        "xp_total": user.xp_total,
        "level": user.level,
        "streaks": {
            s.metric: {"current": s.current_len, "longest": s.longest_len} for s in streaks
        },
        "water_today": {
            "total_ml": water_total,
            "goal_ml": water_goal_ml,
            "percent": water_pct,
        },
        "steps_today": {
            "total": steps_total,
            "goal": steps_target,
            "percent": steps_pct,
        },
        "sleep_last_night": sleep_block,
        "sleep_goal_minutes": int(sleep_goal.target),
    }
