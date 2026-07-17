from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.period_entry import PeriodEntry
from app.models.user import User
from app.services.time_utils import day_for_user


async def upsert(
    db: AsyncSession,
    *,
    user: User,
    entry_date: date,
    flow: str,
    symptoms: list[str],
    note: str | None = None,
) -> PeriodEntry:
    """Create or update the single period row for a given date."""
    row = (
        await db.execute(
            select(PeriodEntry).where(
                PeriodEntry.user_id == user.id,
                PeriodEntry.entry_date == entry_date,
            )
        )
    ).scalar_one_or_none()
    clean_note = (note.strip() or None) if isinstance(note, str) else note
    # De-dup while preserving a stable order for display.
    deduped = sorted(set(symptoms))
    if row is None:
        row = PeriodEntry(
            user_id=user.id,
            entry_date=entry_date,
            flow=flow,
            symptoms=deduped,
            note=clean_note,
        )
        db.add(row)
    else:
        row.flow = flow
        row.symptoms = deduped
        row.note = clean_note
    await db.flush()
    return row


async def list_recent(
    db: AsyncSession, *, user: User, days: int = 180
) -> list[PeriodEntry]:
    cutoff = day_for_user(user.timezone) - timedelta(days=days)
    return list(
        (
            await db.execute(
                select(PeriodEntry)
                .where(
                    PeriodEntry.user_id == user.id,
                    PeriodEntry.entry_date >= cutoff,
                )
                .order_by(PeriodEntry.entry_date.desc())
            )
        )
        .scalars()
        .all()
    )


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    row = (
        await db.execute(
            select(PeriodEntry).where(
                PeriodEntry.id == entry_id,
                PeriodEntry.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    await db.delete(row)
    return True
