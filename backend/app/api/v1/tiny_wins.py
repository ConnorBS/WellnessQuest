from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.tiny_win_item import TinyWinItem
from app.models.user import User
from app.schemas.tiny_win import (
    TinyWinDayCount,
    TinyWinItemIn,
    TinyWinItemOut,
    TinyWinReorderIn,
)
from app.services import tiny_win_service
from app.services.time_utils import day_for_user
from app.telemetry.recorder import audit

router = APIRouter(prefix="/tiny-wins", tags=["tiny-wins"])


def _to_out(item: TinyWinItem, done: bool) -> TinyWinItemOut:
    return TinyWinItemOut(
        id=item.id, label=item.label, sort_order=item.sort_order, done=done
    )


@router.get("", response_model=list[TinyWinItemOut])
async def list_day(
    date_: date | None = Query(default=None, alias="date"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TinyWinItemOut]:
    on = date_ or day_for_user(user.timezone)
    items = await tiny_win_service.list_items(db, user=user)
    checked = await tiny_win_service.checked_item_ids(db, user=user, on=on)
    return [_to_out(i, i.id in checked) for i in items]


@router.get("/counts", response_model=list[TinyWinDayCount])
async def counts(
    days: int = 30,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TinyWinDayCount]:
    days = max(1, min(days, 366))
    by_day = await tiny_win_service.daily_counts(db, user=user, days=days)
    return [TinyWinDayCount(entry_date=d, done=c) for d, c in sorted(by_day.items())]


@router.post("/{item_id}/toggle", response_model=TinyWinItemOut)
async def toggle_item(
    item_id: int,
    date_: date | None = Query(default=None, alias="date"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> TinyWinItemOut:
    on = date_ or day_for_user(user.timezone)
    if on > day_for_user(user.timezone):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="future_date")
    found, now_done = await tiny_win_service.toggle(db, user=user, item_id=item_id, on=on)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    item = await tiny_win_service.get_item(db, user=user, item_id=item_id)
    assert item is not None  # found is True
    await audit(
        db,
        actor=f"user:{user.id}",
        action="tiny_win.check" if now_done else "tiny_win.uncheck",
        user_id=user.id,
        target_type="tiny_win_item",
        target_id=str(item_id),
        meta={"date": on.isoformat()},
    )
    return _to_out(item, now_done)


# --- item management -------------------------------------------------------

@router.post("/items", response_model=TinyWinItemOut, status_code=status.HTTP_201_CREATED)
async def add_item(
    payload: TinyWinItemIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> TinyWinItemOut:
    row = await tiny_win_service.add_item(db, user=user, label=payload.label)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="tiny_win.item.add",
        user_id=user.id,
        target_type="tiny_win_item",
        target_id=str(row.id),
        meta={"label": row.label},
    )
    return _to_out(row, False)


@router.post("/items/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_items(
    payload: TinyWinReorderIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await tiny_win_service.reorder_items(db, user=user, ids=payload.ids)


@router.patch("/items/{item_id}", response_model=TinyWinItemOut)
async def rename_item(
    item_id: int,
    payload: TinyWinItemIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> TinyWinItemOut:
    row = await tiny_win_service.rename_item(
        db, user=user, item_id=item_id, label=payload.label
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return _to_out(row, False)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_item(
    item_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await tiny_win_service.archive_item(db, user=user, item_id=item_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
