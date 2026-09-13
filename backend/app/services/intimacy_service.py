from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intimacy_entry import IntimacyEntry
from app.models.user import User
from app.schemas.intimacy import IntimacyEntryPatch
from app.services.time_utils import day_for_user


def _clean_note(note: str | None) -> str | None:
    return (note.strip() or None) if isinstance(note, str) else note


async def add(
    db: AsyncSession,
    *,
    user: User,
    entry_date: date,
    kind: str,
    protection: str,
    tags: list[str],
    note: str | None = None,
) -> IntimacyEntry:
    row = IntimacyEntry(
        user_id=user.id,
        entry_date=entry_date,
        kind=kind,
        protection=protection,
        # De-dup while keeping a stable order for display.
        tags=sorted(set(tags)),
        note=_clean_note(note),
    )
    db.add(row)
    await db.flush()
    return row


async def list_recent(
    db: AsyncSession, *, user: User, days: int = 180
) -> list[IntimacyEntry]:
    """Newest first, within a window of the user's local today."""
    cutoff = day_for_user(user.timezone) - timedelta(days=days)
    return list(
        (
            await db.execute(
                select(IntimacyEntry)
                .where(
                    IntimacyEntry.user_id == user.id,
                    IntimacyEntry.entry_date >= cutoff,
                )
                .order_by(
                    IntimacyEntry.entry_date.desc(),
                    IntimacyEntry.created_at.desc(),
                    IntimacyEntry.id.desc(),
                )
            )
        )
        .scalars()
        .all()
    )


async def list_day(
    db: AsyncSession, *, user: User, on: date
) -> list[IntimacyEntry]:
    """One day's occurrences, oldest first — the order they were logged."""
    return list(
        (
            await db.execute(
                select(IntimacyEntry)
                .where(
                    IntimacyEntry.user_id == user.id,
                    IntimacyEntry.entry_date == on,
                )
                .order_by(IntimacyEntry.created_at.asc(), IntimacyEntry.id.asc())
            )
        )
        .scalars()
        .all()
    )


async def summary(
    db: AsyncSession, *, user: User, days: int = 30
) -> tuple[int, date | None]:
    """`(count in the window, most recent entry_date)` for the section header."""
    cutoff = day_for_user(user.timezone) - timedelta(days=days)
    row = (
        await db.execute(
            select(
                func.count(IntimacyEntry.id),
                func.max(IntimacyEntry.entry_date),
            ).where(
                IntimacyEntry.user_id == user.id,
                IntimacyEntry.entry_date >= cutoff,
            )
        )
    ).one()
    return int(row[0] or 0), row[1]


async def get(
    db: AsyncSession, *, user: User, entry_id: int
) -> IntimacyEntry | None:
    return (
        await db.execute(
            select(IntimacyEntry).where(
                IntimacyEntry.id == entry_id,
                IntimacyEntry.user_id == user.id,
            )
        )
    ).scalar_one_or_none()


async def update_entry(
    db: AsyncSession, *, user: User, entry_id: int, patch: IntimacyEntryPatch
) -> IntimacyEntry | None:
    row = await get(db, user=user, entry_id=entry_id)
    if row is None:
        return None
    data = patch.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "note":
            # The only field an explicit null clears.
            row.note = _clean_note(value)
        elif value is None:
            continue
        elif field == "tags":
            row.tags = sorted(set(value))
        else:
            setattr(row, field, value)
    await db.flush()
    # `updated_at` comes from the column's server-side onupdate, which leaves the
    # attribute expired after the flush; serialising it would then lazy-load from
    # sync context and die with greenlet_spawn. Refresh while still async.
    await db.refresh(row)
    return row


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    row = await get(db, user=user, entry_id=entry_id)
    if row is None:
        return False
    await db.delete(row)
    return True
