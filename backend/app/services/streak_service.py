from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.streak import Streak
from app.models.user import User


async def extend_if_goal_met(
    db: AsyncSession, *, user: User, metric: str, today: date, goal_met: bool
) -> Streak:
    """Increment streak if today's goal was just met; reset if a gap is detected.

    Idempotent for repeated calls on the same day (no double-increment).
    """
    stmt = select(Streak).where(Streak.user_id == user.id, Streak.metric == metric)
    streak = (await db.execute(stmt)).scalar_one_or_none()
    if streak is None:
        streak = Streak(user_id=user.id, metric=metric, current_len=0, longest_len=0)
        db.add(streak)
        await db.flush()

    if not goal_met:
        return streak

    if streak.last_hit_date == today:
        return streak  # already counted

    if streak.last_hit_date == today - timedelta(days=1):
        streak.current_len += 1
    else:
        streak.current_len = 1

    streak.last_hit_date = today
    if streak.current_len > streak.longest_len:
        streak.longest_len = streak.current_len
    return streak
