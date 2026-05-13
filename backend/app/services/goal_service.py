from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal

DEFAULT_WATER_ML_PER_DAY = 2000
DEFAULT_ACTIVE_MINUTES_PER_DAY = 30
DEFAULT_FOOD_KCAL_PER_DAY = 2000


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


async def _get_or_create(
    db: AsyncSession, *, user_id: uuid.UUID, metric: str, default_target: int
) -> Goal:
    existing = await get_active(db, user_id=user_id, metric=metric, period="day")
    if existing is not None:
        return existing
    goal = Goal(
        user_id=user_id,
        metric=metric,
        period="day",
        target=default_target,
        active=True,
    )
    db.add(goal)
    await db.flush()
    return goal


async def get_or_create_default_water(db: AsyncSession, *, user_id: uuid.UUID) -> Goal:
    return await _get_or_create(
        db, user_id=user_id, metric="water_ml", default_target=DEFAULT_WATER_ML_PER_DAY
    )


async def get_or_create_default_activity(db: AsyncSession, *, user_id: uuid.UUID) -> Goal:
    return await _get_or_create(
        db,
        user_id=user_id,
        metric="active_minutes",
        default_target=DEFAULT_ACTIVE_MINUTES_PER_DAY,
    )


async def get_or_create_default_food(db: AsyncSession, *, user_id: uuid.UUID) -> Goal:
    return await _get_or_create(
        db,
        user_id=user_id,
        metric="food_kcal",
        default_target=DEFAULT_FOOD_KCAL_PER_DAY,
    )
