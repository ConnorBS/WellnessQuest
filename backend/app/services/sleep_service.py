from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sleep_entry import SleepEntry
from app.models.user import User
from app.services import events, goal_service, streak_service, xp_service
from app.services.time_utils import day_bounds_for_user, day_for_user


class SleepAddResult:
    __slots__ = ("entry", "goal_minutes", "xp_delta", "goal_met")

    def __init__(
        self,
        *,
        entry: SleepEntry,
        goal_minutes: int,
        xp_delta: int,
        goal_met: bool,
    ) -> None:
        self.entry = entry
        self.goal_minutes = goal_minutes
        self.xp_delta = xp_delta
        self.goal_met = goal_met


async def last_session(
    db: AsyncSession, *, user: User, for_date: date | None = None
) -> SleepEntry | None:
    """Most recent session; scoped to sessions that *ended* on `for_date` if given."""
    stmt = select(SleepEntry).where(SleepEntry.user_id == user.id)
    if for_date is not None:
        start, end = day_bounds_for_user(user.timezone, for_date)
        stmt = stmt.where(SleepEntry.ended_at >= start, SleepEntry.ended_at < end)
    stmt = stmt.order_by(SleepEntry.ended_at.desc()).limit(1)
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_recent(db: AsyncSession, *, user: User, limit: int = 14) -> list[SleepEntry]:
    stmt = (
        select(SleepEntry)
        .where(SleepEntry.user_id == user.id)
        .order_by(SleepEntry.ended_at.desc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    stmt = select(SleepEntry).where(
        SleepEntry.id == entry_id, SleepEntry.user_id == user.id
    )
    entry = (await db.execute(stmt)).scalar_one_or_none()
    if entry is None:
        return False
    await db.delete(entry)
    await db.flush()
    return True


async def add(
    db: AsyncSession,
    *,
    user: User,
    started_at: datetime,
    ended_at: datetime,
    source: str,
    client_id: str | None,
    quality_score: int | None = None,
) -> SleepAddResult:
    duration = int((ended_at - started_at).total_seconds() // 60)
    if duration <= 0:
        raise ValueError("ended_at must be after started_at")
    duration = min(duration, 1440)

    goal = await goal_service.get_or_create_default_sleep(db, user_id=user.id)
    goal_minutes = int(goal.target)
    today = day_for_user(user.timezone)
    # A session belongs to the day it ended on. Back-filled nights still get XP
    # but must not rewrite today's streak.
    ended_day = day_for_user(user.timezone, ended_at)

    entry = SleepEntry(
        user_id=user.id,
        started_at=started_at,
        ended_at=ended_at,
        duration_minutes=duration,
        quality_score=quality_score,
        source=source,
        client_id=client_id,
    )
    try:
        async with db.begin_nested():
            db.add(entry)
            await db.flush()
    except IntegrityError:
        return await _get_by_client_id(
            db, user=user, client_id=client_id, goal_minutes=goal_minutes
        )

    xp_delta = await xp_service.grant_for_sleep(
        db, user=user, minutes=duration, ref_id=entry.id
    )
    goal_met = duration >= goal_minutes
    if goal_met:
        xp_delta += await xp_service.grant_goal_met(db, user=user, metric="sleep_minutes")

    if ended_day == today:
        await streak_service.extend_if_goal_met(
            db, user=user, metric="sleep_minutes", today=today, goal_met=goal_met
        )

    await db.flush()

    await events.emit(
        user.id,
        "sleep.session_logged",
        {
            "duration_minutes": duration,
            "quality_score": quality_score,
            "goal_met": goal_met,
            "goal_minutes": goal_minutes,
            "ended_at": ended_at.isoformat(),
        },
    )

    return SleepAddResult(
        entry=entry, goal_minutes=goal_minutes, xp_delta=xp_delta, goal_met=goal_met
    )


async def _get_by_client_id(
    db: AsyncSession, *, user: User, client_id: str | None, goal_minutes: int
) -> SleepAddResult:
    stmt = select(SleepEntry).where(
        SleepEntry.user_id == user.id, SleepEntry.client_id == client_id
    )
    entry = (await db.execute(stmt)).scalar_one()
    return SleepAddResult(
        entry=entry,
        goal_minutes=goal_minutes,
        xp_delta=0,
        goal_met=entry.duration_minutes >= goal_minutes,
    )
