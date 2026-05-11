from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.water_entry import WaterEntry
from app.services import events, goal_service, streak_service, xp_service
from app.services.time_utils import day_bounds_for_user, day_for_user, utcnow


class WaterAddResult:
    __slots__ = ("entry", "total_ml", "goal_ml", "xp_delta", "goal_met", "newly_met")

    def __init__(
        self,
        *,
        entry: WaterEntry,
        total_ml: int,
        goal_ml: int,
        xp_delta: int,
        goal_met: bool,
        newly_met: bool,
    ) -> None:
        self.entry = entry
        self.total_ml = total_ml
        self.goal_ml = goal_ml
        self.xp_delta = xp_delta
        self.goal_met = goal_met
        self.newly_met = newly_met


async def total_today(db: AsyncSession, *, user: User) -> int:
    today = day_for_user(user.timezone)
    start, end = day_bounds_for_user(user.timezone, today)
    stmt = select(func.coalesce(func.sum(WaterEntry.ml), 0)).where(
        WaterEntry.user_id == user.id,
        WaterEntry.occurred_at >= start,
        WaterEntry.occurred_at < end,
    )
    return int((await db.execute(stmt)).scalar_one())


async def list_today(db: AsyncSession, *, user: User) -> list[WaterEntry]:
    today = day_for_user(user.timezone)
    start, end = day_bounds_for_user(user.timezone, today)
    stmt = (
        select(WaterEntry)
        .where(
            WaterEntry.user_id == user.id,
            WaterEntry.occurred_at >= start,
            WaterEntry.occurred_at < end,
        )
        .order_by(WaterEntry.occurred_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def add(
    db: AsyncSession,
    *,
    user: User,
    ml: int,
    source: str,
    client_id: str | None,
    occurred_at: datetime | None,
) -> WaterAddResult:
    today = day_for_user(user.timezone)
    before_total = await total_today(db, user=user)
    goal = await goal_service.get_or_create_default_water(db, user_id=user.id)
    goal_ml = int(goal.target)
    was_met = before_total >= goal_ml

    entry = WaterEntry(
        user_id=user.id,
        ml=ml,
        source=source,
        occurred_at=occurred_at or utcnow(),
        client_id=client_id,
    )
    db.add(entry)
    try:
        await db.flush()
    except IntegrityError:
        # client_id collision -> return the existing row (idempotent)
        await db.rollback()
        return await _get_by_client_id(db, user=user, client_id=client_id, goal_ml=goal_ml)

    xp_delta = await xp_service.grant_for_water(db, user=user, ml=ml, ref_id=entry.id)

    new_total = before_total + ml
    now_met = new_total >= goal_ml
    newly_met = now_met and not was_met
    if newly_met:
        xp_delta += await xp_service.grant_goal_met(db, user=user, metric="water_ml")

    await streak_service.extend_if_goal_met(
        db, user=user, metric="water_ml", today=today, goal_met=now_met
    )

    await db.flush()

    if newly_met:
        await events.emit(
            user.id,
            "water.goal_met",
            {"goal_ml": goal_ml, "total_ml": new_total, "date": today.isoformat()},
        )

    return WaterAddResult(
        entry=entry,
        total_ml=new_total,
        goal_ml=goal_ml,
        xp_delta=xp_delta,
        goal_met=now_met,
        newly_met=newly_met,
    )


async def _get_by_client_id(
    db: AsyncSession, *, user: User, client_id: str | None, goal_ml: int
) -> WaterAddResult:
    stmt = select(WaterEntry).where(
        WaterEntry.user_id == user.id, WaterEntry.client_id == client_id
    )
    entry = (await db.execute(stmt)).scalar_one()
    total = await total_today(db, user=user)
    return WaterAddResult(
        entry=entry,
        total_ml=total,
        goal_ml=goal_ml,
        xp_delta=0,
        goal_met=total >= goal_ml,
        newly_met=False,
    )


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    stmt = select(WaterEntry).where(WaterEntry.id == entry_id, WaterEntry.user_id == user.id)
    entry = (await db.execute(stmt)).scalar_one_or_none()
    if entry is None:
        return False
    await db.delete(entry)
    return True
