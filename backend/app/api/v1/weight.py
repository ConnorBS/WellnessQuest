from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.user import User
from app.schemas.weight import WeightEntryIn, WeightEntryOut, WeightSummaryOut
from app.services import weight_service
from app.services.time_utils import utcnow
from app.telemetry.recorder import audit

router = APIRouter(prefix="/weight", tags=["weight"])


def _to_out(row) -> WeightEntryOut:  # type: ignore[no-untyped-def]
    return WeightEntryOut(
        id=row.id,
        weight_kg=row.weight_kg,
        occurred_at=row.occurred_at,
        note=row.note,
    )


@router.get("/summary", response_model=WeightSummaryOut)
async def weight_summary(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> WeightSummaryOut:
    latest = await weight_service.latest(db, user=user)
    prior = None
    delta: Decimal | None = None
    if latest is not None:
        prior = await weight_service.closest_before(
            db, user=user, anchor=latest.occurred_at, max_lookback_days=14
        )
        if prior is not None:
            delta = (latest.weight_kg - prior.weight_kg).quantize(Decimal("0.01"))
    return WeightSummaryOut(
        unit=user.weight_unit,
        latest=_to_out(latest) if latest is not None else None,
        prior_week=_to_out(prior) if prior is not None else None,
        delta_kg=delta,
    )


@router.get("", response_model=list[WeightEntryOut])
async def list_history(
    limit: int = 90,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WeightEntryOut]:
    limit = max(1, min(limit, 365))
    rows = await weight_service.list_history(db, user=user, limit=limit)
    return [_to_out(r) for r in rows]


@router.post("", response_model=WeightEntryOut, status_code=status.HTTP_201_CREATED)
async def add_weight(
    payload: WeightEntryIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> WeightEntryOut:
    row = await weight_service.add(
        db,
        user=user,
        weight_kg=payload.weight_kg,
        occurred_at=payload.occurred_at or utcnow(),
        note=payload.note,
    )
    await audit(
        db,
        actor=f"user:{user.id}",
        action="weight.add",
        user_id=user.id,
        target_type="weight_entry",
        target_id=str(row.id),
        meta={"weight_kg": str(row.weight_kg)},
    )
    return _to_out(row)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_weight(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await weight_service.delete(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="weight.delete",
        user_id=user.id,
        target_type="weight_entry",
        target_id=str(entry_id),
    )
