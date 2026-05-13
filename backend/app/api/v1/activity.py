from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.user import User
from app.schemas.activity import (
    ActivityAddIn,
    ActivityAddOut,
    ActivityEntryOut,
    ActivityRecentEntry,
    ActivityTodayOut,
)
from app.schemas.activity_preset import ActivityGoalOut, ActivityGoalUpdate
from app.services import activity_service, goal_service
from app.services.time_utils import day_for_user
from app.telemetry.recorder import audit

router = APIRouter(prefix="/activity", tags=["activity"])


@router.patch("/goal", response_model=ActivityGoalOut)
async def update_activity_goal(
    payload: ActivityGoalUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityGoalOut:
    goal = await goal_service.get_or_create_default_activity(db, user_id=user.id)
    goal.target = payload.target_minutes
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="activity.goal.update",
        user_id=user.id,
        target_type="goal",
        target_id=str(goal.id),
        meta={"target_minutes": payload.target_minutes},
    )
    return ActivityGoalOut(target_minutes=int(goal.target))


@router.get("/today", response_model=ActivityTodayOut)
async def activity_today(
    date_: date | None = Query(default=None, alias="date"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityTodayOut:
    day = date_ or day_for_user(user.timezone)
    goal = await goal_service.get_or_create_default_activity(db, user_id=user.id)
    total = await activity_service.total_today(db, user=user, for_date=day)
    entries = await activity_service.list_today(db, user=user, for_date=day)
    goal_minutes = int(goal.target)
    pct = min(100, round((total / goal_minutes) * 100)) if goal_minutes else 0
    return ActivityTodayOut(
        date=day.isoformat(),
        total_minutes=total,
        goal_minutes=goal_minutes,
        percent=pct,
        entries=[
            ActivityEntryOut(
                id=e.id,
                minutes=e.minutes,
                source=e.source,
                occurred_at=e.occurred_at,
                client_id=e.client_id,
                exercise_type=e.exercise_type,
            )
            for e in entries
        ],
    )


@router.get("/recent", response_model=list[ActivityRecentEntry])
async def activity_recent(
    limit: int = Query(default=8, ge=1, le=20),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ActivityRecentEntry]:
    """Most recently logged distinct activity types, for the quick-log name dropdown."""
    rows = await activity_service.recent_distinct(db, user=user, limit=limit)
    return [
        ActivityRecentEntry(
            exercise_type=r.exercise_type or "",
            minutes=r.minutes,
            last_logged_at=r.occurred_at,
        )
        for r in rows
        if r.exercise_type
    ]


@router.post("", response_model=ActivityAddOut, status_code=status.HTTP_201_CREATED)
async def add_activity(
    payload: ActivityAddIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityAddOut:
    result = await activity_service.add(
        db,
        user=user,
        minutes=payload.minutes,
        source="pwa",
        client_id=payload.client_id,
        occurred_at=payload.occurred_at,
        exercise_type=payload.exercise_type,
    )
    await audit(
        db,
        actor=f"user:{user.id}",
        action="activity.add",
        user_id=user.id,
        target_type="activity_entry",
        target_id=str(result.entry.id),
        meta={
            "minutes": payload.minutes,
            "source": "pwa",
            "client_id": payload.client_id,
            "exercise_type": payload.exercise_type,
        },
    )
    return ActivityAddOut(
        entry=ActivityEntryOut(
            id=result.entry.id,
            minutes=result.entry.minutes,
            source=result.entry.source,
            occurred_at=result.entry.occurred_at,
            client_id=result.entry.client_id,
            exercise_type=result.entry.exercise_type,
        ),
        total_minutes=result.total_minutes,
        goal_minutes=result.goal_minutes,
        xp_delta=result.xp_delta,
        goal_met=result.goal_met,
    )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await activity_service.delete(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="activity.delete",
        user_id=user.id,
        target_type="activity_entry",
        target_id=str(entry_id),
    )
