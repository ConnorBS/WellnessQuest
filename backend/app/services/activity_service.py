from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_entry import ActivityEntry
from app.models.user import User
from app.services import events, goal_service, streak_service, xp_service
from app.services.time_utils import day_bounds_for_user, day_for_user, utcnow


class ActivityAddResult:
    __slots__ = ("entry", "total_minutes", "goal_minutes", "xp_delta", "goal_met", "newly_met")

    def __init__(
        self,
        *,
        entry: ActivityEntry,
        total_minutes: int,
        goal_minutes: int,
        xp_delta: int,
        goal_met: bool,
        newly_met: bool,
    ) -> None:
        self.entry = entry
        self.total_minutes = total_minutes
        self.goal_minutes = goal_minutes
        self.xp_delta = xp_delta
        self.goal_met = goal_met
        self.newly_met = newly_met


async def total_today(db: AsyncSession, *, user: User, for_date: date | None = None) -> int:
    day = for_date or day_for_user(user.timezone)
    start, end = day_bounds_for_user(user.timezone, day)
    stmt = select(func.coalesce(func.sum(ActivityEntry.minutes), 0)).where(
        ActivityEntry.user_id == user.id,
        ActivityEntry.occurred_at >= start,
        ActivityEntry.occurred_at < end,
    )
    return int((await db.execute(stmt)).scalar_one())


async def list_today(db: AsyncSession, *, user: User, for_date: date | None = None) -> list[ActivityEntry]:
    day = for_date or day_for_user(user.timezone)
    start, end = day_bounds_for_user(user.timezone, day)
    stmt = (
        select(ActivityEntry)
        .where(
            ActivityEntry.user_id == user.id,
            ActivityEntry.occurred_at >= start,
            ActivityEntry.occurred_at < end,
        )
        .order_by(ActivityEntry.occurred_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def add(
    db: AsyncSession,
    *,
    user: User,
    minutes: int,
    source: str,
    client_id: str | None,
    occurred_at: datetime | None,
    exercise_type: str | None = None,
) -> ActivityAddResult:
    today = day_for_user(user.timezone)
    before_total = await total_today(db, user=user)
    goal = await goal_service.get_or_create_default_activity(db, user_id=user.id)
    goal_minutes = int(goal.target)
    was_met = before_total >= goal_minutes

    entry = ActivityEntry(
        user_id=user.id,
        minutes=minutes,
        source=source,
        exercise_type=(exercise_type.strip() or None) if exercise_type else None,
        occurred_at=occurred_at or utcnow(),
        client_id=client_id,
    )
    try:
        async with db.begin_nested():
            db.add(entry)
            await db.flush()
    except IntegrityError:
        return await _get_by_client_id(db, user=user, client_id=client_id, goal_minutes=goal_minutes)

    xp_delta = await xp_service.grant_for_activity(db, user=user, minutes=minutes, ref_id=entry.id)

    new_total = before_total + minutes
    now_met = new_total >= goal_minutes
    newly_met = now_met and not was_met
    if newly_met:
        xp_delta += await xp_service.grant_goal_met(db, user=user, metric="active_minutes")

    await streak_service.extend_if_goal_met(
        db, user=user, metric="active_minutes", today=today, goal_met=now_met
    )

    await db.flush()

    if newly_met:
        await events.emit(
            user.id,
            "activity.goal_met",
            {"goal_minutes": goal_minutes, "total_minutes": new_total, "date": today.isoformat()},
        )

    return ActivityAddResult(
        entry=entry,
        total_minutes=new_total,
        goal_minutes=goal_minutes,
        xp_delta=xp_delta,
        goal_met=now_met,
        newly_met=newly_met,
    )


async def _get_by_client_id(
    db: AsyncSession, *, user: User, client_id: str | None, goal_minutes: int
) -> ActivityAddResult:
    stmt = select(ActivityEntry).where(
        ActivityEntry.user_id == user.id, ActivityEntry.client_id == client_id
    )
    entry = (await db.execute(stmt)).scalar_one()
    total = await total_today(db, user=user)
    return ActivityAddResult(
        entry=entry,
        total_minutes=total,
        goal_minutes=goal_minutes,
        xp_delta=0,
        goal_met=total >= goal_minutes,
        newly_met=False,
    )


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    stmt = select(ActivityEntry).where(
        ActivityEntry.id == entry_id, ActivityEntry.user_id == user.id
    )
    entry = (await db.execute(stmt)).scalar_one_or_none()
    if entry is None:
        return False
    await db.delete(entry)
    return True
