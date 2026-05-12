"""Idempotent seed run on container startup. Also runnable via `python -m app.db.seed`."""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.auth.passwords import hash_password
from app.config import settings
from app.db.session import async_session
from app.models.activity_preset import ActivityPreset
from app.models.goal import Goal
from app.models.user import User
from app.models.water_preset import WaterPreset
from app.services.goal_service import DEFAULT_ACTIVE_MINUTES_PER_DAY, DEFAULT_WATER_ML_PER_DAY
from app.telemetry.logger import configure_logging, get_logger

DEFAULT_WATER_PRESETS: tuple[tuple[str, int, str, str, int], ...] = (
    ("Small cup", 125, "builtin", "glass-small", 0),
    ("Tall cup", 250, "builtin", "glass-tall", 1),
    ("Bottle", 500, "builtin", "water-bottle", 2),
)

DEFAULT_ACTIVITY_PRESETS: tuple[tuple[str, int, str, str, int], ...] = (
    ("Stretch", 5, "builtin", "stretch", 0),
    ("Walk", 15, "builtin", "walk", 1),
    ("Cardio", 30, "builtin", "cardio", 2),
)

log = get_logger(__name__)


async def _upsert_user(
    db, *, email: str, password: str, display_name: str, role: str
) -> tuple[User | None, bool]:
    if not (email and password and password.strip()):
        log.info("seed_user_skipped_blank_credentials", role=role)
        return None, False
    row = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if row is None:
        row = User(
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
            role=role,
            timezone=settings.tz,
        )
        db.add(row)
        await db.flush()
        log.info("seed_user_created", email=email, role=role)
        return row, True
    log.info("seed_user_exists", email=email)
    return row, False


async def _ensure_water_goal(db, user: User) -> None:
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
        log.info("seed_water_goal_created", user=user.email)


async def _ensure_activity_goal(db, user: User) -> None:
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
        log.info("seed_activity_goal_created", user=user.email)


async def _seed_default_water_presets(db, user: User) -> None:
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
    log.info("seed_water_presets_created", user=user.email, count=len(DEFAULT_WATER_PRESETS))


async def _seed_default_activity_presets(db, user: User) -> None:
    for label, minutes, kind, key, sort in DEFAULT_ACTIVITY_PRESETS:
        db.add(
            ActivityPreset(
                user_id=user.id,
                label=label,
                minutes=minutes,
                icon_kind=kind,
                icon_key=key,
                sort_order=sort,
            )
        )
    log.info("seed_activity_presets_created", user=user.email, count=len(DEFAULT_ACTIVITY_PRESETS))


async def run() -> None:
    configure_logging()
    async with async_session() as db:
        admin, admin_created = await _upsert_user(
            db,
            email=settings.admin_email,
            password=settings.admin_password,
            display_name="Admin",
            role="admin",
        )
        partner, partner_created = await _upsert_user(
            db,
            email=settings.partner_email,
            password=settings.partner_password,
            display_name="Partner",
            role="user",
        )
        if admin is not None:
            await _ensure_water_goal(db, admin)
            await _ensure_activity_goal(db, admin)
            if admin_created:
                await _seed_default_water_presets(db, admin)
                await _seed_default_activity_presets(db, admin)
        if partner is not None:
            await _ensure_water_goal(db, partner)
            await _ensure_activity_goal(db, partner)
            if partner_created:
                await _seed_default_water_presets(db, partner)
                await _seed_default_activity_presets(db, partner)
        await db.commit()
        log.info("seed_done")


if __name__ == "__main__":
    asyncio.run(run())
