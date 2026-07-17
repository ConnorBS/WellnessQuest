from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.period_entry import PeriodEntry
from app.models.user import User
from app.schemas.period import PeriodEntryIn, PeriodEntryOut
from app.services import period_service
from app.telemetry.recorder import audit

router = APIRouter(prefix="/period", tags=["period"])


def _to_out(row: PeriodEntry) -> PeriodEntryOut:
    return PeriodEntryOut(
        id=row.id,
        entry_date=row.entry_date,
        flow=row.flow,
        symptoms=list(row.symptoms),
        note=row.note,
    )


@router.get("", response_model=list[PeriodEntryOut])
async def list_history(
    days: int = 180,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PeriodEntryOut]:
    days = max(1, min(days, 730))
    rows = await period_service.list_recent(db, user=user, days=days)
    return [_to_out(r) for r in rows]


@router.post("", response_model=PeriodEntryOut, status_code=status.HTTP_201_CREATED)
async def upsert_period(
    payload: PeriodEntryIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> PeriodEntryOut:
    row = await period_service.upsert(
        db,
        user=user,
        entry_date=payload.entry_date,
        flow=payload.flow,
        symptoms=list(payload.symptoms),
        note=payload.note,
    )
    await audit(
        db,
        actor=f"user:{user.id}",
        action="period.upsert",
        user_id=user.id,
        target_type="period_entry",
        target_id=str(row.id),
        meta={"entry_date": row.entry_date.isoformat(), "flow": row.flow},
    )
    return _to_out(row)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_period(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await period_service.delete(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="period.delete",
        user_id=user.id,
        target_type="period_entry",
        target_id=str(entry_id),
    )
