from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.xp_event import XpEvent
from app.services.time_utils import day_bounds_for_user

# XP rules (slice 1+2):
#   water_entry:           floor(ml / 100)        capped at WATER_DAILY_CAP per local day
#   activity_entry:        minutes                capped at ACTIVITY_DAILY_CAP per local day
#   goal_met:<metric>:     +50                    (one-shot per crossing; service layer enforces)
WATER_DAILY_CAP = 20
ACTIVITY_DAILY_CAP = 30
FOOD_DAILY_CAP = 5
GOAL_MET_XP = 50


def _level_for_xp(xp: int) -> int:
    """Simple curve: level n requires 100 * n * (n-1) / 2 cumulative XP."""
    level = 1
    while xp >= 100 * level * (level + 1) // 2:
        level += 1
    return level


async def grant_for_water(
    db: AsyncSession, *, user: User, ml: int, ref_id: int
) -> int:
    """Grant XP for a water entry, respecting the daily cap. Returns amount granted."""
    start, end = day_bounds_for_user(user.timezone, _today_for(user))
    stmt = select(func.coalesce(func.sum(XpEvent.amount), 0)).where(
        XpEvent.user_id == user.id,
        XpEvent.reason == "water_entry",
        XpEvent.created_at >= start,
        XpEvent.created_at < end,
    )
    earned_today = int((await db.execute(stmt)).scalar_one())
    available = max(0, WATER_DAILY_CAP - earned_today)
    grant = min(ml // 100, available)
    if grant <= 0:
        return 0
    db.add(
        XpEvent(
            user_id=user.id,
            amount=grant,
            reason="water_entry",
            ref_type="water_entry",
            ref_id=str(ref_id),
        )
    )
    user.xp_total += grant
    user.level = _level_for_xp(user.xp_total)
    return grant


async def grant_for_activity(
    db: AsyncSession, *, user: User, minutes: int, ref_id: int
) -> int:
    """Grant XP for an activity entry, respecting the daily cap. Returns amount granted."""
    start, end = day_bounds_for_user(user.timezone, _today_for(user))
    stmt = select(func.coalesce(func.sum(XpEvent.amount), 0)).where(
        XpEvent.user_id == user.id,
        XpEvent.reason == "activity_entry",
        XpEvent.created_at >= start,
        XpEvent.created_at < end,
    )
    earned_today = int((await db.execute(stmt)).scalar_one())
    available = max(0, ACTIVITY_DAILY_CAP - earned_today)
    grant = min(minutes, available)
    if grant <= 0:
        return 0
    db.add(
        XpEvent(
            user_id=user.id,
            amount=grant,
            reason="activity_entry",
            ref_type="activity_entry",
            ref_id=str(ref_id),
        )
    )
    user.xp_total += grant
    user.level = _level_for_xp(user.xp_total)
    return grant


async def grant_for_food(
    db: AsyncSession, *, user: User, kcal: int, ref_id: int
) -> int:
    """Grant 1 XP per logged food entry, capped daily. Returns amount granted.

    Food has 'ceiling' goal semantics, so we don't grant any XP based on kcal
    amount — that would reward over-eating. Just a flat per-log reward.
    """
    del kcal  # not used; XP is per-log, not per-kcal
    start, end = day_bounds_for_user(user.timezone, _today_for(user))
    stmt = select(func.coalesce(func.sum(XpEvent.amount), 0)).where(
        XpEvent.user_id == user.id,
        XpEvent.reason == "food_entry",
        XpEvent.created_at >= start,
        XpEvent.created_at < end,
    )
    earned_today = int((await db.execute(stmt)).scalar_one())
    if earned_today >= FOOD_DAILY_CAP:
        return 0
    db.add(
        XpEvent(
            user_id=user.id,
            amount=1,
            reason="food_entry",
            ref_type="food_entry",
            ref_id=str(ref_id),
        )
    )
    user.xp_total += 1
    user.level = _level_for_xp(user.xp_total)
    return 1


async def grant_goal_met(
    db: AsyncSession, *, user: User, metric: str
) -> int:
    db.add(
        XpEvent(
            user_id=user.id,
            amount=GOAL_MET_XP,
            reason=f"goal_met:{metric}",
            ref_type="goal",
            ref_id=metric,
        )
    )
    user.xp_total += GOAL_MET_XP
    user.level = _level_for_xp(user.xp_total)
    return GOAL_MET_XP


def _today_for(user: User):  # type: ignore[no-untyped-def]
    from app.services.time_utils import day_for_user

    return day_for_user(user.timezone)
