from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.reflux_entry import RefluxEntry
from app.models.user import User
from app.schemas.reflux import (
    RefluxEntryIn,
    RefluxEntryOut,
    RefluxEntryPatch,
    RefluxSummaryOut,
)
from app.services import reflux_service
from app.telemetry.recorder import audit

router = APIRouter(prefix="/reflux", tags=["reflux"])


def _to_out(row: RefluxEntry) -> RefluxEntryOut:
    return RefluxEntryOut(
        id=row.id,
        severity=row.severity,
        occurred_at=row.occurred_at,
        triggers=list(row.triggers),
        note=row.note,
    )


@router.get("/summary", response_model=RefluxSummaryOut)
async def reflux_summary(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> RefluxSummaryOut:
    latest = await reflux_service.latest(db, user=user)
    return RefluxSummaryOut(
        latest=_to_out(latest) if latest is not None else None,
        today_count=await reflux_service.today_count(db, user=user),
        week_count=await reflux_service.week_count(db, user=user),
    )


@router.get("", response_model=list[RefluxEntryOut])
async def list_history(
    limit: int = 90,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RefluxEntryOut]:
    limit = max(1, min(limit, 366))
    rows = await reflux_service.list_history(db, user=user, limit=limit)
    return [_to_out(r) for r in rows]


@router.post("", response_model=RefluxEntryOut, status_code=status.HTTP_201_CREATED)
async def add_reflux(
    payload: RefluxEntryIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> RefluxEntryOut:
    row = await reflux_service.add(
        db,
        user=user,
        severity=payload.severity,
        triggers=list(payload.triggers),
        occurred_at=payload.occurred_at,
        note=payload.note,
    )
    await audit(
        db,
        actor=f"user:{user.id}",
        action="reflux.add",
        user_id=user.id,
        target_type="reflux_entry",
        target_id=str(row.id),
        meta={"severity": row.severity, "triggers": len(row.triggers)},
    )
    return _to_out(row)


@router.patch("/{entry_id}", response_model=RefluxEntryOut)
async def update_reflux(
    entry_id: int,
    payload: RefluxEntryPatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> RefluxEntryOut:
    row = await reflux_service.update_entry(
        db, user=user, entry_id=entry_id, patch=payload
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="reflux.update",
        user_id=user.id,
        target_type="reflux_entry",
        target_id=str(row.id),
        meta={"fields": list(payload.model_dump(exclude_unset=True).keys())},
    )
    return _to_out(row)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reflux(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await reflux_service.delete(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="reflux.delete",
        user_id=user.id,
        target_type="reflux_entry",
        target_id=str(entry_id),
    )
