from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.weight_entry import WeightEntry
from app.models.weight_target import WeightTarget
from app.schemas.weight import WeightEntryPatch
from app.services.time_utils import utcnow


async def add(
    db: AsyncSession,
    *,
    user: User,
    weight_kg: Decimal,
    occurred_at: datetime | None = None,
    note: str | None = None,
) -> WeightEntry:
    entry = WeightEntry(
        user_id=user.id,
        weight_kg=weight_kg,
        occurred_at=occurred_at or utcnow(),
        note=note,
    )
    db.add(entry)
    await db.flush()
    return entry


async def latest(db: AsyncSession, *, user: User) -> WeightEntry | None:
    return (
        await db.execute(
            select(WeightEntry)
            .where(WeightEntry.user_id == user.id)
            .order_by(WeightEntry.occurred_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def closest_before(
    db: AsyncSession, *, user: User, anchor: datetime, max_lookback_days: int = 60
) -> WeightEntry | None:
    """Find the entry whose occurred_at is the latest within [anchor - max_lookback_days,
    anchor - 1 day). Used for the "delta vs last week" card line."""
    floor = anchor - timedelta(days=max_lookback_days)
    ceiling = anchor - timedelta(days=1)
    return (
        await db.execute(
            select(WeightEntry)
            .where(
                WeightEntry.user_id == user.id,
                WeightEntry.occurred_at >= floor,
                WeightEntry.occurred_at < ceiling,
            )
            .order_by(WeightEntry.occurred_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def list_history(
    db: AsyncSession, *, user: User, limit: int = 90
) -> list[WeightEntry]:
    return list(
        (
            await db.execute(
                select(WeightEntry)
                .where(WeightEntry.user_id == user.id)
                .order_by(WeightEntry.occurred_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )


async def update_entry(
    db: AsyncSession,
    *,
    user: User,
    entry_id: int,
    patch: WeightEntryPatch,
) -> WeightEntry | None:
    """Apply a partial update to a weight entry. Returns None when not found."""
    row = (
        await db.execute(
            select(WeightEntry).where(
                WeightEntry.id == entry_id, WeightEntry.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    data = patch.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "note" and isinstance(value, str):
            stripped = value.strip()
            setattr(row, field, stripped or None)
        else:
            setattr(row, field, value)
    await db.flush()
    return row


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    row = (
        await db.execute(
            select(WeightEntry).where(
                WeightEntry.id == entry_id, WeightEntry.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    await db.delete(row)
    return True


# --- weight targets ---------------------------------------------------------

async def add_target(
    db: AsyncSession,
    *,
    user: User,
    target_kg: Decimal | None,
    effective_at: datetime | None = None,
) -> WeightTarget:
    row = WeightTarget(
        user_id=user.id,
        target_kg=target_kg,
        effective_at=effective_at or utcnow(),
    )
    db.add(row)
    await db.flush()
    return row


async def current_target(db: AsyncSession, *, user: User) -> WeightTarget | None:
    return (
        await db.execute(
            select(WeightTarget)
            .where(WeightTarget.user_id == user.id)
            .order_by(WeightTarget.effective_at.desc(), WeightTarget.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def list_targets(
    db: AsyncSession, *, user: User, limit: int = 90
) -> list[WeightTarget]:
    return list(
        (
            await db.execute(
                select(WeightTarget)
                .where(WeightTarget.user_id == user.id)
                .order_by(WeightTarget.effective_at.desc(), WeightTarget.id.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )


async def delete_target(db: AsyncSession, *, user: User, target_id: int) -> bool:
    row = (
        await db.execute(
            select(WeightTarget).where(
                WeightTarget.id == target_id, WeightTarget.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    await db.delete(row)
    return True
