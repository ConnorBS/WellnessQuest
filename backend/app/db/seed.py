"""Idempotent seed run on container startup. Also runnable via `python -m app.db.seed`."""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.auth.passwords import hash_password
from app.config import settings
from app.db.session import async_session
from app.models.goal import Goal
from app.models.user import User
from app.services.goal_service import DEFAULT_WATER_ML_PER_DAY
from app.telemetry.logger import configure_logging, get_logger

log = get_logger(__name__)


async def _upsert_user(db, *, email: str, password: str, display_name: str, role: str) -> User | None:
    if not (email and password and password.strip()):
        log.info("seed_user_skipped_blank_credentials", role=role)
        return None
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
    else:
        log.info("seed_user_exists", email=email)
    return row


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


async def run() -> None:
    configure_logging()
    async with async_session() as db:
        admin = await _upsert_user(
            db,
            email=settings.admin_email,
            password=settings.admin_password,
            display_name="Admin",
            role="admin",
        )
        partner = await _upsert_user(
            db,
            email=settings.partner_email,
            password=settings.partner_password,
            display_name="Partner",
            role="user",
        )
        if admin is not None:
            await _ensure_water_goal(db, admin)
        if partner is not None:
            await _ensure_water_goal(db, partner)
        await db.commit()
        log.info("seed_done")


if __name__ == "__main__":
    asyncio.run(run())
