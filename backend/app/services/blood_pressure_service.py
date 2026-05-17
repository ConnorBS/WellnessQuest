from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blood_pressure_entry import BloodPressureEntry
from app.models.blood_pressure_target import BloodPressureTarget
from app.models.user import User
from app.services.time_utils import utcnow


async def add(
    db: AsyncSession,
    *,
    user: User,
    systolic: int,
    diastolic: int,
    pulse: int | None = None,
    occurred_at: datetime | None = None,
    note: str | None = None,
) -> BloodPressureEntry:
    entry = BloodPressureEntry(
        user_id=user.id,
        systolic=systolic,
        diastolic=diastolic,
        pulse=pulse,
        occurred_at=occurred_at or utcnow(),
        note=note,
    )
    db.add(entry)
    await db.flush()
    return entry


async def latest(db: AsyncSession, *, user: User) -> BloodPressureEntry | None:
    return (
        await db.execute(
            select(BloodPressureEntry)
            .where(BloodPressureEntry.user_id == user.id)
            .order_by(BloodPressureEntry.occurred_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def list_history(
    db: AsyncSession, *, user: User, limit: int = 90
) -> list[BloodPressureEntry]:
    return list(
        (
            await db.execute(
                select(BloodPressureEntry)
                .where(BloodPressureEntry.user_id == user.id)
                .order_by(BloodPressureEntry.occurred_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    row = (
        await db.execute(
            select(BloodPressureEntry).where(
                BloodPressureEntry.id == entry_id,
                BloodPressureEntry.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    await db.delete(row)
    return True


# --- targets ---------------------------------------------------------------

async def add_target(
    db: AsyncSession,
    *,
    user: User,
    target_systolic: int | None,
    target_diastolic: int | None,
    effective_at: datetime | None = None,
) -> BloodPressureTarget:
    row = BloodPressureTarget(
        user_id=user.id,
        target_systolic=target_systolic,
        target_diastolic=target_diastolic,
        effective_at=effective_at or utcnow(),
    )
    db.add(row)
    await db.flush()
    return row


async def current_target(
    db: AsyncSession, *, user: User
) -> BloodPressureTarget | None:
    return (
        await db.execute(
            select(BloodPressureTarget)
            .where(BloodPressureTarget.user_id == user.id)
            .order_by(
                BloodPressureTarget.effective_at.desc(),
                BloodPressureTarget.id.desc(),
            )
            .limit(1)
        )
    ).scalar_one_or_none()


async def list_targets(
    db: AsyncSession, *, user: User, limit: int = 90
) -> list[BloodPressureTarget]:
    return list(
        (
            await db.execute(
                select(BloodPressureTarget)
                .where(BloodPressureTarget.user_id == user.id)
                .order_by(
                    BloodPressureTarget.effective_at.desc(),
                    BloodPressureTarget.id.desc(),
                )
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )


async def delete_target(
    db: AsyncSession, *, user: User, target_id: int
) -> bool:
    row = (
        await db.execute(
            select(BloodPressureTarget).where(
                BloodPressureTarget.id == target_id,
                BloodPressureTarget.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    await db.delete(row)
    return True
