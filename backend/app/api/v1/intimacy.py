"""Sexual-activity log, mounted inside the period section.

Paths say ``intimacy`` rather than ``sex`` on purpose: ad, privacy and DNS
filters match the latter in a URL and kill the request with no useful error,
exactly the failure mode that forced the ``/move`` alias for activity. The
user-facing label is still "Sexual activity".
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.intimacy_entry import IntimacyEntry
from app.models.user import User
from app.schemas.intimacy import (
    IntimacyEntryIn,
    IntimacyEntryOut,
    IntimacyEntryPatch,
    IntimacySummaryOut,
)
from app.services import intimacy_service
from app.services.time_utils import day_for_user
from app.telemetry.recorder import audit

router = APIRouter(prefix="/period/intimacy", tags=["intimacy"])


def _to_out(row: IntimacyEntry) -> IntimacyEntryOut:
    return IntimacyEntryOut(
        id=row.id,
        entry_date=row.entry_date,
        kind=row.kind,
        protection=row.protection,
        tags=list(row.tags),
        note=row.note,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _reject_future(user: User, on: date) -> None:
    if on > day_for_user(user.timezone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="future_date"
        )


async def _audit(
    db: AsyncSession, *, user: User, action: str, entry_id: int, on: date | None
) -> None:
    """Audit rows carry the date and nothing else. Kind, protection, tags and the
    note are the private part and stay out of the log — same call as journal
    bodies."""
    await audit(
        db,
        actor=f"user:{user.id}",
        action=action,
        user_id=user.id,
        target_type="intimacy_entry",
        target_id=str(entry_id),
        meta={"entry_date": on.isoformat()} if on else None,
    )


@router.get("", response_model=list[IntimacyEntryOut])
async def list_history(
    days: int = 180,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[IntimacyEntryOut]:
    days = max(1, min(days, 730))
    rows = await intimacy_service.list_recent(db, user=user, days=days)
    return [_to_out(r) for r in rows]


@router.get("/day", response_model=list[IntimacyEntryOut])
async def list_day(
    date_: date | None = Query(default=None, alias="date"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[IntimacyEntryOut]:
    on = date_ or day_for_user(user.timezone)
    rows = await intimacy_service.list_day(db, user=user, on=on)
    return [_to_out(r) for r in rows]


@router.get("/summary", response_model=IntimacySummaryOut)
async def summary(
    days: int = 30,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> IntimacySummaryOut:
    days = max(1, min(days, 730))
    count, last = await intimacy_service.summary(db, user=user, days=days)
    return IntimacySummaryOut(days=days, count=count, last_entry_date=last)


@router.post("", response_model=IntimacyEntryOut, status_code=status.HTTP_201_CREATED)
async def add_entry(
    payload: IntimacyEntryIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> IntimacyEntryOut:
    on = payload.entry_date or day_for_user(user.timezone)
    _reject_future(user, on)
    row = await intimacy_service.add(
        db,
        user=user,
        entry_date=on,
        kind=payload.kind,
        protection=payload.protection,
        tags=list(payload.tags),
        note=payload.note,
    )
    await _audit(db, user=user, action="intimacy.add", entry_id=row.id, on=row.entry_date)
    return _to_out(row)


@router.patch("/{entry_id}", response_model=IntimacyEntryOut)
async def update_entry(
    entry_id: int,
    payload: IntimacyEntryPatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> IntimacyEntryOut:
    if payload.entry_date is not None:
        _reject_future(user, payload.entry_date)
    row = await intimacy_service.update_entry(
        db, user=user, entry_id=entry_id, patch=payload
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await _audit(
        db, user=user, action="intimacy.update", entry_id=row.id, on=row.entry_date
    )
    return _to_out(row)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await intimacy_service.delete(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await _audit(db, user=user, action="intimacy.delete", entry_id=entry_id, on=None)
