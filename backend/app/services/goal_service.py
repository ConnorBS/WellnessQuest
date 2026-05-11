from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal

DEFAULT_WATER_ML_PER_DAY = 2000


async def get_active(
    db: AsyncSession, *, user_id: uuid.UUID, metric: str, period: str = "day"
) -> Goal | None:
    stmt = select(Goal).where(
        Goal.user_id == user_id,
        Goal.metric == metric,
        Goal.period == period,
        Goal.active.is_(True),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_or_create_default_water(
    db: AsyncSession, *, user_id: uuid.UUID
) -> Goal:
    existing = await get_active(db, user_id=user_id, metric="water_ml", period="day")
    if existing is not None:
        return existing
    goal = Goal(
        user_id=user_id,
        metric="water_ml",
        period="day",
        target=DEFAULT_WATER_ML_PER_DAY,
        active=True,
    )
    db.add(goal)
    await db.flush()
    return goal
