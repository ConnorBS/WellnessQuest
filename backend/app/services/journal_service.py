from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.journal_entry import JournalEntry
from app.models.user import User
from app.schemas.journal import JournalEntryPatch


async def add(
    db: AsyncSession, *, user: User, entry_date: date, body: str
) -> JournalEntry:
    entry = JournalEntry(user_id=user.id, entry_date=entry_date, body=body.strip())
    db.add(entry)
    await db.flush()
    return entry


async def list_day(
    db: AsyncSession, *, user: User, on: date
) -> list[JournalEntry]:
    """A day's notes, oldest first — the order they were written in."""
    return list(
        (
            await db.execute(
                select(JournalEntry)
                .where(
                    JournalEntry.user_id == user.id,
                    JournalEntry.entry_date == on,
                )
                .order_by(JournalEntry.created_at.asc(), JournalEntry.id.asc())
            )
        )
        .scalars()
        .all()
    )


async def list_recent(
    db: AsyncSession, *, user: User, limit: int = 50
) -> list[JournalEntry]:
    """Newest notes across all days, for the history view."""
    return list(
        (
            await db.execute(
                select(JournalEntry)
                .where(JournalEntry.user_id == user.id)
                .order_by(
                    JournalEntry.entry_date.desc(),
                    JournalEntry.created_at.desc(),
                    JournalEntry.id.desc(),
                )
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )


async def day_count(db: AsyncSession, *, user: User, on: date) -> int:
    return (
        await db.execute(
            select(func.count())
            .select_from(JournalEntry)
            .where(
                JournalEntry.user_id == user.id,
                JournalEntry.entry_date == on,
            )
        )
    ).scalar_one()


async def latest_for_day(
    db: AsyncSession, *, user: User, on: date
) -> JournalEntry | None:
    return (
        await db.execute(
            select(JournalEntry)
            .where(
                JournalEntry.user_id == user.id,
                JournalEntry.entry_date == on,
            )
            .order_by(JournalEntry.created_at.desc(), JournalEntry.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def get(db: AsyncSession, *, user: User, entry_id: int) -> JournalEntry | None:
    return (
        await db.execute(
            select(JournalEntry).where(
                JournalEntry.id == entry_id, JournalEntry.user_id == user.id
            )
        )
    ).scalar_one_or_none()


async def update_entry(
    db: AsyncSession, *, user: User, entry_id: int, patch: JournalEntryPatch
) -> JournalEntry | None:
    row = await get(db, user=user, entry_id=entry_id)
    if row is None:
        return None
    data = patch.model_dump(exclude_unset=True)
    for field, value in data.items():
        if value is None:
            # A null in a patch means "leave it" here; there is no field on a
            # journal entry that can be cleared to nothing.
            continue
        setattr(row, field, value.strip() if field == "body" else value)
    await db.flush()
    # `updated_at` is computed server-side by the column's onupdate, which leaves
    # the attribute expired after the flush. Serialising the row would then try
    # to lazy-load it from sync context and blow up with greenlet_spawn; refresh
    # it here while we're still in async context.
    await db.refresh(row)
    return row


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    row = await get(db, user=user, entry_id=entry_id)
    if row is None:
        return False
    await db.delete(row)
    return True
