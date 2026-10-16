from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mood_entry import MoodEntry
from app.models.user import User
from app.schemas.mood import MoodEntryPatch
from app.services.time_utils import day_bounds_for_user, day_for_user, utcnow


async def add(
    db: AsyncSession,
    *,
    user: User,
    moods: Sequence[str],
    energy: int,
    occurred_at: datetime | None = None,
    note: str | None = None,
) -> MoodEntry:
    entry = MoodEntry(
        user_id=user.id,
        moods=list(moods),
        energy=energy,
        occurred_at=occurred_at or utcnow(),
        note=(note.strip() or None) if isinstance(note, str) else note,
    )
    db.add(entry)
    await db.flush()
    return entry


async def latest(db: AsyncSession, *, user: User) -> MoodEntry | None:
    return (
        await db.execute(
            select(MoodEntry)
            .where(MoodEntry.user_id == user.id)
            .order_by(MoodEntry.occurred_at.desc(), MoodEntry.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def today_count(db: AsyncSession, *, user: User) -> int:
    start, end = day_bounds_for_user(user.timezone, day_for_user(user.timezone))
    return (
        await db.execute(
            select(func.count())
            .select_from(MoodEntry)
            .where(
                MoodEntry.user_id == user.id,
                MoodEntry.occurred_at >= start,
                MoodEntry.occurred_at < end,
            )
        )
    ).scalar_one()


async def list_history(
    db: AsyncSession, *, user: User, limit: int = 90
) -> list[MoodEntry]:
    return list(
        (
            await db.execute(
                select(MoodEntry)
                .where(MoodEntry.user_id == user.id)
                .order_by(MoodEntry.occurred_at.desc(), MoodEntry.id.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )


async def update_entry(
    db: AsyncSession, *, user: User, entry_id: int, patch: MoodEntryPatch
) -> MoodEntry | None:
    row = (
        await db.execute(
            select(MoodEntry).where(
                MoodEntry.id == entry_id, MoodEntry.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    data = patch.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "note" and isinstance(value, str):
            setattr(row, field, value.strip() or None)
        else:
            setattr(row, field, value)
    await db.flush()
    return row


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    row = (
        await db.execute(
            select(MoodEntry).where(
                MoodEntry.id == entry_id, MoodEntry.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    await db.delete(row)
    return True
