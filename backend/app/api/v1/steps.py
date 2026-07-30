from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.steps_entry import StepsEntry
from app.models.user import User
from app.schemas.steps import StepsAddIn, StepsAddOut, StepsEntryOut, StepsTodayOut
from app.services import goal_service, steps_service
from app.services.time_utils import day_for_user
from app.telemetry.recorder import audit

router = APIRouter(prefix="/steps", tags=["steps"])


def _entry_out(entry: StepsEntry) -> StepsEntryOut:
    return StepsEntryOut(
        id=entry.id,
        count=entry.count,
        source=entry.source,
        occurred_at=entry.occurred_at,
        client_id=entry.client_id,
    )


@router.get("/today", response_model=StepsTodayOut)
async def steps_today(
    date_: date | None = Query(default=None, alias="date"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> StepsTodayOut:
    day = date_ or day_for_user(user.timezone)
    goal = await goal_service.get_or_create_default_steps(db, user_id=user.id)
    total = await steps_service.total_today(db, user=user, for_date=day)
    entries = await steps_service.list_for_day(db, user=user, for_date=day)
    goal_target = int(goal.target)
    pct = min(100, round((total / goal_target) * 100)) if goal_target else 0
    return StepsTodayOut(
        date=day.isoformat(),
        total=total,
        goal=goal_target,
        percent=pct,
        entries=[_entry_out(e) for e in entries],
    )


@router.post("", response_model=StepsAddOut, status_code=status.HTTP_201_CREATED)
async def add_steps(
    payload: StepsAddIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> StepsAddOut:
    """Log steps by hand, for users with no Home Assistant / wearable feed."""
    result = await steps_service.add(
        db,
        user=user,
        count=payload.count,
        source="pwa",
        client_id=payload.client_id,
        occurred_at=payload.occurred_at,
    )
    # This log may cross a title threshold; flag for a re-scan on the next /me
    # so the unlock surfaces immediately rather than on the 24h lazy scan.
    user.titles_last_scan_at = None
    await audit(
        db,
        actor=f"user:{user.id}",
        action="steps.add",
        user_id=user.id,
        target_type="steps_entry",
        target_id=str(result.entry.id),
        meta={"count": payload.count, "source": "pwa", "client_id": payload.client_id},
    )
    return StepsAddOut(
        entry=_entry_out(result.entry),
        total=result.total,
        goal=result.goal,
        xp_delta=result.xp_delta,
        goal_met=result.goal_met,
    )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_steps(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await steps_service.delete(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="steps.delete",
        user_id=user.id,
        target_type="steps_entry",
        target_id=str(entry_id),
    )
