from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reflux_entry import RefluxEntry
from app.models.user import User
from app.schemas.reflux import RefluxEntryPatch
from app.services.time_utils import day_bounds_for_user, day_for_user, utcnow


def _clean_note(note: str | None) -> str | None:
    return (note.strip() or None) if isinstance(note, str) else note


async def add(
    db: AsyncSession,
    *,
    user: User,
    severity: str,
    triggers: list[str],
    occurred_at: datetime | None = None,
    note: str | None = None,
) -> RefluxEntry:
    entry = RefluxEntry(
        user_id=user.id,
        severity=severity,
        occurred_at=occurred_at or utcnow(),
        # De-dup while keeping a stable order for display.
        triggers=sorted(set(triggers)),
        note=_clean_note(note),
    )
    db.add(entry)
    await db.flush()
    return entry


async def latest(db: AsyncSession, *, user: User) -> RefluxEntry | None:
    return (
        await db.execute(
            select(RefluxEntry)
            .where(RefluxEntry.user_id == user.id)
            .order_by(RefluxEntry.occurred_at.desc(), RefluxEntry.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def _count_between(
    db: AsyncSession, *, user: User, start: datetime, end: datetime
) -> int:
    return (
        await db.execute(
            select(func.count())
            .select_from(RefluxEntry)
            .where(
                RefluxEntry.user_id == user.id,
                RefluxEntry.occurred_at >= start,
                RefluxEntry.occurred_at < end,
            )
        )
    ).scalar_one()


async def today_count(db: AsyncSession, *, user: User) -> int:
    start, end = day_bounds_for_user(user.timezone, day_for_user(user.timezone))
    return await _count_between(db, user=user, start=start, end=end)


async def week_count(db: AsyncSession, *, user: User) -> int:
    """Episodes in the last 7 local days including today."""
    today = day_for_user(user.timezone)
    start, _ = day_bounds_for_user(user.timezone, today - timedelta(days=6))
    _, end = day_bounds_for_user(user.timezone, today)
    return await _count_between(db, user=user, start=start, end=end)


async def list_history(
    db: AsyncSession, *, user: User, limit: int = 90
) -> list[RefluxEntry]:
    return list(
        (
            await db.execute(
                select(RefluxEntry)
                .where(RefluxEntry.user_id == user.id)
                .order_by(RefluxEntry.occurred_at.desc(), RefluxEntry.id.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )


async def get(db: AsyncSession, *, user: User, entry_id: int) -> RefluxEntry | None:
    return (
        await db.execute(
            select(RefluxEntry).where(
                RefluxEntry.id == entry_id, RefluxEntry.user_id == user.id
            )
        )
    ).scalar_one_or_none()


async def update_entry(
    db: AsyncSession, *, user: User, entry_id: int, patch: RefluxEntryPatch
) -> RefluxEntry | None:
    row = await get(db, user=user, entry_id=entry_id)
    if row is None:
        return None
    data = patch.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "note":
            row.note = _clean_note(value)
        elif value is None:
            continue
        elif field == "triggers":
            row.triggers = sorted(set(value))
        else:
            setattr(row, field, value)
    await db.flush()
    return row


async def delete(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    row = await get(db, user=user, entry_id=entry_id)
    if row is None:
        return False
    await db.delete(row)
    return True
