"""Per-user default assets created when a new account is provisioned.

Replaces the env-var-driven seed: instead of running on container startup, the
setup endpoint and the admin "create user" endpoint call `bootstrap_user_assets`
so each new account starts with sensible defaults (water + activity goals, the
built-in presets, and a few habit examples).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_preset import ActivityPreset
from app.models.goal import Goal
from app.models.habit import Habit
from app.models.symptom_catalog import DEFAULT_SYMPTOMS, SymptomCatalog
from app.models.user import User
from app.models.water_preset import WaterPreset
from app.services import title_service
from app.services.goal_service import (
    DEFAULT_ACTIVE_MINUTES_PER_DAY,
    DEFAULT_WATER_ML_PER_DAY,
)

DEFAULT_WATER_PRESETS: tuple[tuple[str, int, str, str, int], ...] = (
    ("Small cup", 125, "builtin", "glass-small", 0),
    ("Tall cup", 250, "builtin", "glass-tall", 1),
    ("Bottle", 500, "builtin", "water-bottle", 2),
)

# (label, minutes, icon_kind, icon_key, sort_order, exercise_type)
DEFAULT_ACTIVITY_PRESETS: tuple[tuple[str, int, str, str, int, str | None], ...] = (
    ("Stretch", 5, "builtin", "stretch", 0, "Stretching"),
    ("Walk", 15, "builtin", "walk", 1, "Walking"),
    ("Cardio", 30, "builtin", "cardio", 2, "Cardio"),
)

# (name, icon_key, cadence_kind, weekly_target, interval_days, sort_order)
DEFAULT_HABITS: tuple[tuple[str, str, str, int | None, int | None, int], ...] = (
    ("Read 10 minutes", "droplet", "daily", None, None, 0),
    ("Workout", "dumbbell", "weekly", 3, None, 1),
    ("Take vitamins", "droplet", "interval", None, 2, 2),
)


async def _ensure_water_goal(db: AsyncSession, user: User) -> None:
    existing = (
        await db.execute(
            select(Goal).where(
                Goal.user_id == user.id,
                Goal.metric == "water_ml",
                Goal.period == "day",
                Goal.active.is_(True),
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(
            Goal(
                user_id=user.id,
                metric="water_ml",
                period="day",
                target=DEFAULT_WATER_ML_PER_DAY,
                active=True,
            )
        )


async def _ensure_activity_goal(db: AsyncSession, user: User) -> None:
    existing = (
        await db.execute(
            select(Goal).where(
                Goal.user_id == user.id,
                Goal.metric == "active_minutes",
                Goal.period == "day",
                Goal.active.is_(True),
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(
            Goal(
                user_id=user.id,
                metric="active_minutes",
                period="day",
                target=DEFAULT_ACTIVE_MINUTES_PER_DAY,
                active=True,
            )
        )


async def _seed_default_water_presets(db: AsyncSession, user: User) -> None:
    for label, ml, kind, key, sort in DEFAULT_WATER_PRESETS:
        db.add(
            WaterPreset(
                user_id=user.id,
                label=label,
                volume_ml=ml,
                icon_kind=kind,
                icon_key=key,
                sort_order=sort,
            )
        )


async def _seed_default_activity_presets(db: AsyncSession, user: User) -> None:
    for label, minutes, kind, key, sort, exercise_type in DEFAULT_ACTIVITY_PRESETS:
        db.add(
            ActivityPreset(
                user_id=user.id,
                label=label,
                minutes=minutes,
                exercise_type=exercise_type,
                icon_kind=kind,
                icon_key=key,
                sort_order=sort,
            )
        )


async def _seed_default_habits(db: AsyncSession, user: User) -> None:
    for name, icon_key, cadence, weekly_target, interval_days, sort in DEFAULT_HABITS:
        db.add(
            Habit(
                user_id=user.id,
                name=name,
                icon_kind="builtin",
                icon_key=icon_key,
                cadence_kind=cadence,
                weekly_target=weekly_target,
                interval_days=interval_days,
                sort_order=sort,
            )
        )


async def _seed_default_symptoms(db: AsyncSession, user: User) -> None:
    for sort, name in enumerate(DEFAULT_SYMPTOMS):
        db.add(SymptomCatalog(user_id=user.id, name=name, sort_order=sort))


async def bootstrap_user_assets(db: AsyncSession, user: User) -> None:
    """Create default goals, presets, and habits for a freshly-created user."""
    await _ensure_water_goal(db, user)
    await _ensure_activity_goal(db, user)
    await _seed_default_water_presets(db, user)
    await _seed_default_activity_presets(db, user)
    await _seed_default_habits(db, user)
    await _seed_default_symptoms(db, user)
    # Grant the Newbie title (and any other immediately-eligible titles
    # the catalog already includes). No-op when the catalog is empty.
    await title_service.scan_user(db, user)
