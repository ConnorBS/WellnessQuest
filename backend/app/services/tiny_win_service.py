from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tiny_win_checkin import TinyWinCheckin
from app.models.tiny_win_item import TinyWinItem
from app.models.user import User
from app.services.time_utils import day_for_user, utcnow


async def list_items(
    db: AsyncSession, *, user: User, include_archived: bool = False
) -> list[TinyWinItem]:
    stmt = select(TinyWinItem).where(TinyWinItem.user_id == user.id)
    if not include_archived:
        stmt = stmt.where(TinyWinItem.archived_at.is_(None))
    stmt = stmt.order_by(TinyWinItem.sort_order, TinyWinItem.id)
    return list((await db.execute(stmt)).scalars().all())


async def checked_item_ids(
    db: AsyncSession, *, user: User, on: date
) -> set[int]:
    rows = (
        await db.execute(
            select(TinyWinCheckin.item_id).where(
                TinyWinCheckin.user_id == user.id,
                TinyWinCheckin.entry_date == on,
            )
        )
    ).scalars().all()
    return set(rows)


async def add_item(db: AsyncSession, *, user: User, label: str) -> TinyWinItem:
    existing = await list_items(db, user=user, include_archived=True)
    next_sort = 1 + max((r.sort_order for r in existing), default=-1)
    row = TinyWinItem(user_id=user.id, label=label.strip(), sort_order=next_sort)
    db.add(row)
    await db.flush()
    return row


async def rename_item(
    db: AsyncSession, *, user: User, item_id: int, label: str
) -> TinyWinItem | None:
    row = await get_item(db, user=user, item_id=item_id)
    if row is None:
        return None
    row.label = label.strip()
    await db.flush()
    return row


async def archive_item(db: AsyncSession, *, user: User, item_id: int) -> bool:
    row = await get_item(db, user=user, item_id=item_id)
    if row is None or row.archived_at is not None:
        return False
    row.archived_at = utcnow()
    await db.flush()
    return True


async def reorder_items(db: AsyncSession, *, user: User, ids: list[int]) -> None:
    rows = {r.id: r for r in await list_items(db, user=user, include_archived=True)}
    for index, iid in enumerate(ids):
        row = rows.get(iid)
        if row is not None:
            row.sort_order = index
    await db.flush()


async def get_item(
    db: AsyncSession, *, user: User, item_id: int
) -> TinyWinItem | None:
    return (
        await db.execute(
            select(TinyWinItem).where(
                TinyWinItem.id == item_id,
                TinyWinItem.user_id == user.id,
            )
        )
    ).scalar_one_or_none()


async def toggle(
    db: AsyncSession, *, user: User, item_id: int, on: date
) -> tuple[bool, bool]:
    """Toggle a check-in for (item, date). Returns (found, now_done)."""
    item = await get_item(db, user=user, item_id=item_id)
    if item is None or item.archived_at is not None:
        return (False, False)
    existing = (
        await db.execute(
            select(TinyWinCheckin).where(
                TinyWinCheckin.item_id == item_id,
                TinyWinCheckin.entry_date == on,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(TinyWinCheckin(user_id=user.id, item_id=item_id, entry_date=on))
        await db.flush()
        return (True, True)
    await db.delete(existing)
    await db.flush()
    return (True, False)


async def daily_counts(
    db: AsyncSession, *, user: User, days: int = 30
) -> dict[date, int]:
    cutoff = day_for_user(user.timezone) - timedelta(days=days)
    rows = (
        await db.execute(
            select(TinyWinCheckin.entry_date, func.count())
            .where(
                TinyWinCheckin.user_id == user.id,
                TinyWinCheckin.entry_date >= cutoff,
            )
            .group_by(TinyWinCheckin.entry_date)
        )
    ).all()
    return {r[0]: r[1] for r in rows}
