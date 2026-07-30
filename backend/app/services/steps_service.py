from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.steps_entry import StepsEntry
from app.models.user import User
from app.services import events, goal_service, streak_service, xp_service
from app.services.time_utils import day_bounds_for_user, day_for_user, utcnow


class StepsAddResult:
    __slots__ = ("entry", "total", "goal", "xp_delta", "goal_met", "newly_met")

    def __init__(
        self,
        *,
        entry: StepsEntry,
        total: int,
        goal: int,
        xp_delta: int,
        goal_met: bool,
        newly_met: bool,
    ) -> None:
        self.entry = entry
        self.total = total
        self.goal = goal
        self.xp_delta = xp_delta
        self.goal_met = goal_met
        self.newly_met = newly_met


async def total_today(db: AsyncSession, *, user: User, for_date: date | None = None) -> int:
    day = for_date or day_for_user(user.timezone)
    start, end = day_bounds_for_user(user.timezone, day)
    stmt = select(func.coalesce(func.sum(StepsEntry.count), 0)).where(
        StepsEntry.user_id == user.id,
        StepsEntry.occurred_at >= start,
        StepsEntry.occurred_at < end,
    )
    return int((await db.execute(stmt)).scalar_one())


async def list_for_day(
    db: AsyncSession, *, user: User, for_date: date | None = None
) -> list[StepsEntry]:
    day = for_date or day_for_user(user.timezone)
    start, end = day_bounds_for_user(user.timezone, day)
    stmt = (
        select(StepsEntry)
        .where(
            StepsEntry.user_id == user.id,
            StepsEntry.occurred_at >= start,
            StepsEntry.occurred_at < end,
        )
        .order_by(StepsEntry.occurred_at.desc(), StepsEntry.id.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    stmt = select(StepsEntry).where(
        StepsEntry.id == entry_id, StepsEntry.user_id == user.id
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
    count: int,
    source: str,
    client_id: str | None,
    occurred_at: datetime | None,
) -> StepsAddResult:
    today = day_for_user(user.timezone)
    at = occurred_at or utcnow()
    # Manual entries can be backdated via the day switcher, so goal/streak math
    # follows the day the entry lands on rather than always "today". Streaks are
    # still only extended for today (see below) — back-filling an old day must
    # not rewrite streak history.
    entry_day = day_for_user(user.timezone, at)
    before_total = await total_today(db, user=user, for_date=entry_day)
    goal = await goal_service.get_or_create_default_steps(db, user_id=user.id)
    goal_target = int(goal.target)
    was_met = before_total >= goal_target

    entry = StepsEntry(
        user_id=user.id,
        count=count,
        source=source,
        occurred_at=at,
        client_id=client_id,
    )
    try:
        async with db.begin_nested():
            db.add(entry)
            await db.flush()
    except IntegrityError:
        return await _get_by_client_id(db, user=user, client_id=client_id, goal=goal_target)

    xp_delta = await xp_service.grant_for_steps(db, user=user, count=count, ref_id=entry.id)

    new_total = before_total + count
    now_met = new_total >= goal_target
    newly_met = now_met and not was_met
    if newly_met:
        xp_delta += await xp_service.grant_goal_met(db, user=user, metric="steps")

    if entry_day == today:
        await streak_service.extend_if_goal_met(
            db, user=user, metric="steps", today=today, goal_met=now_met
        )

    await db.flush()

    if newly_met:
        await events.emit(
            user.id,
            "steps.daily_goal_met",
            {"count": new_total, "goal": goal_target, "date": entry_day.isoformat()},
        )

    return StepsAddResult(
        entry=entry,
        total=new_total,
        goal=goal_target,
        xp_delta=xp_delta,
        goal_met=now_met,
        newly_met=newly_met,
    )


async def _get_by_client_id(
    db: AsyncSession, *, user: User, client_id: str | None, goal: int
) -> StepsAddResult:
    stmt = select(StepsEntry).where(
        StepsEntry.user_id == user.id, StepsEntry.client_id == client_id
    )
    entry = (await db.execute(stmt)).scalar_one()
    total = await total_today(db, user=user)
    return StepsAddResult(
        entry=entry,
        total=total,
        goal=goal,
        xp_delta=0,
        goal_met=total >= goal,
        newly_met=False,
    )
