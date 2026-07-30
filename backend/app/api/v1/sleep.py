from __future__ import annotations

from datetime import UTC, date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.sleep_entry import SleepEntry
from app.models.user import User
from app.schemas.sleep import (
    SleepAddIn,
    SleepAddOut,
    SleepEntryOut,
    SleepGoalOut,
    SleepGoalUpdate,
    SleepLastOut,
)
from app.services import goal_service, sleep_service
from app.services.time_utils import utcnow
from app.telemetry.recorder import audit

router = APIRouter(prefix="/sleep", tags=["sleep"])

# Phone and wearable clocks drift; anything further ahead than this is a typo,
# not skew.
FUTURE_TOLERANCE = timedelta(minutes=10)


def _entry_out(entry: SleepEntry) -> SleepEntryOut:
    return SleepEntryOut(
        id=entry.id,
        started_at=entry.started_at,
        ended_at=entry.ended_at,
        duration_minutes=entry.duration_minutes,
        quality_score=entry.quality_score,
        source=entry.source,
        client_id=entry.client_id,
    )


@router.patch("/goal", response_model=SleepGoalOut)
async def update_sleep_goal(
    payload: SleepGoalUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> SleepGoalOut:
    goal = await goal_service.get_or_create_default_sleep(db, user_id=user.id)
    goal.target = payload.target_minutes
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="sleep.goal.update",
        user_id=user.id,
        target_type="goal",
        target_id=str(goal.id),
        meta={"target_minutes": payload.target_minutes},
    )
    return SleepGoalOut(target_minutes=int(goal.target))


@router.get("/last", response_model=SleepLastOut)
async def sleep_last(
    date_: date | None = Query(default=None, alias="date"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> SleepLastOut:
    """Latest sleep session. With `?date=`, the latest one that *ended* that day."""
    goal = await goal_service.get_or_create_default_sleep(db, user_id=user.id)
    entry = await sleep_service.last_session(db, user=user, for_date=date_)
    return SleepLastOut(
        entry=_entry_out(entry) if entry is not None else None,
        goal_minutes=int(goal.target),
    )


@router.get("/recent", response_model=list[SleepEntryOut])
async def sleep_recent(
    limit: int = Query(default=14, ge=1, le=60),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SleepEntryOut]:
    rows = await sleep_service.list_recent(db, user=user, limit=limit)
    return [_entry_out(r) for r in rows]


@router.post("", response_model=SleepAddOut, status_code=status.HTTP_201_CREATED)
async def add_sleep(
    payload: SleepAddIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> SleepAddOut:
    """Log a sleep session by hand, for users with no CPAP / wearable feed."""
    ended_at = payload.ended_at
    if ended_at.tzinfo is None:
        ended_at = ended_at.replace(tzinfo=UTC)
    if ended_at > utcnow() + FUTURE_TOLERANCE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="future_time")

    try:
        result = await sleep_service.add(
            db,
            user=user,
            started_at=payload.started_at,
            ended_at=payload.ended_at,
            source="pwa",
            client_id=payload.client_id,
            quality_score=payload.quality_score,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_range"
        ) from exc

    # This log may cross a title threshold; flag for a re-scan on the next /me
    # so the unlock surfaces immediately rather than on the 24h lazy scan.
    user.titles_last_scan_at = None
    await audit(
        db,
        actor=f"user:{user.id}",
        action="sleep.add",
        user_id=user.id,
        target_type="sleep_entry",
        target_id=str(result.entry.id),
        meta={
            "duration_minutes": result.entry.duration_minutes,
            "quality_score": payload.quality_score,
            "source": "pwa",
            "client_id": payload.client_id,
        },
    )
    return SleepAddOut(
        entry=_entry_out(result.entry),
        goal_minutes=result.goal_minutes,
        xp_delta=result.xp_delta,
        goal_met=result.goal_met,
    )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sleep(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await sleep_service.delete(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="sleep.delete",
        user_id=user.id,
        target_type="sleep_entry",
        target_id=str(entry_id),
    )
