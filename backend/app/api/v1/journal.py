from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.journal_entry import JournalEntry
from app.models.user import User
from app.schemas.journal import (
    JournalEntryIn,
    JournalEntryOut,
    JournalEntryPatch,
    JournalSummaryOut,
)
from app.services import journal_service
from app.services.time_utils import day_for_user
from app.telemetry.recorder import audit

router = APIRouter(prefix="/journal", tags=["journal"])


def _to_out(row: JournalEntry) -> JournalEntryOut:
    return JournalEntryOut(
        id=row.id,
        entry_date=row.entry_date,
        body=row.body,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _reject_future(user: User, on: date) -> None:
    if on > day_for_user(user.timezone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="future_date"
        )


@router.get("", response_model=list[JournalEntryOut])
async def list_day(
    date_: date | None = Query(default=None, alias="date"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[JournalEntryOut]:
    on = date_ or day_for_user(user.timezone)
    rows = await journal_service.list_day(db, user=user, on=on)
    return [_to_out(r) for r in rows]


@router.get("/recent", response_model=list[JournalEntryOut])
async def list_recent(
    limit: int = 50,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[JournalEntryOut]:
    limit = max(1, min(limit, 365))
    rows = await journal_service.list_recent(db, user=user, limit=limit)
    return [_to_out(r) for r in rows]


@router.get("/summary", response_model=JournalSummaryOut)
async def summary(
    date_: date | None = Query(default=None, alias="date"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> JournalSummaryOut:
    on = date_ or day_for_user(user.timezone)
    latest = await journal_service.latest_for_day(db, user=user, on=on)
    count = await journal_service.day_count(db, user=user, on=on)
    return JournalSummaryOut(
        entry_date=on,
        count=count,
        latest=_to_out(latest) if latest is not None else None,
    )


@router.post("", response_model=JournalEntryOut, status_code=status.HTTP_201_CREATED)
async def add_entry(
    payload: JournalEntryIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> JournalEntryOut:
    on = payload.entry_date or day_for_user(user.timezone)
    _reject_future(user, on)
    row = await journal_service.add(db, user=user, entry_date=on, body=payload.body)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="journal.add",
        user_id=user.id,
        target_type="journal_entry",
        target_id=str(row.id),
        # Deliberately no body in the audit meta — the note is the private part.
        meta={"date": on.isoformat(), "length": len(row.body)},
    )
    return _to_out(row)


@router.patch("/{entry_id}", response_model=JournalEntryOut)
async def update_entry(
    entry_id: int,
    payload: JournalEntryPatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> JournalEntryOut:
    if payload.entry_date is not None:
        _reject_future(user, payload.entry_date)
    row = await journal_service.update_entry(
        db, user=user, entry_id=entry_id, patch=payload
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="journal.update",
        user_id=user.id,
        target_type="journal_entry",
        target_id=str(row.id),
        meta={"fields": list(payload.model_dump(exclude_unset=True).keys())},
    )
    return _to_out(row)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await journal_service.delete(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="journal.delete",
        user_id=user.id,
        target_type="journal_entry",
        target_id=str(entry_id),
    )
