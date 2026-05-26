from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.user import User
from app.models.weight_target import WeightTarget
from app.schemas.weight import (
    WeightEntryIn,
    WeightEntryOut,
    WeightEntryPatch,
    WeightSummaryOut,
    WeightTargetIn,
    WeightTargetOut,
    WeightTrendPoint,
    WeightTrendSeriesOut,
)
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


def _target_to_out(row: WeightTarget) -> WeightTargetOut:
    return WeightTargetOut(
        id=row.id,
        target_kg=row.target_kg,
        effective_at=row.effective_at,
    )


@router.get("/summary", response_model=WeightSummaryOut)
async def weight_summary(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> WeightSummaryOut:
    latest = await weight_service.latest(db, user=user)
    prior = None
    delta: Decimal | None = None
    trend_kg: Decimal | None = None
    trend_delta_kg: Decimal | None = None
    trend_ready = False
    if latest is not None:
        prior = await weight_service.closest_before(
            db, user=user, anchor=latest.occurred_at, max_lookback_days=14
        )
        if prior is not None:
            delta = (latest.weight_kg - prior.weight_kg).quantize(Decimal("0.01"))
        # Trend computation uses a wider window (90 entries) so the EWMA
        # has had time to converge before we expose it.
        history = await weight_service.list_history(db, user=user, limit=90)
        if history:
            oldest_first = list(reversed(history))
            series = weight_service.compute_ewma_trend(oldest_first)
            trend_kg = series[-1][1].quantize(Decimal("0.01"))
            span_days = (series[-1][0] - series[0][0]).days
            if (
                len(series) >= weight_service.TREND_MIN_ENTRIES
                and span_days >= 7
            ):
                trend_ready = True
                trend_delta_kg = weight_service.trend_delta(series)
    current_target = await weight_service.current_target(db, user=user)
    starting_kg = await weight_service.starting_weight_for_target(
        db, user=user, target=current_target
    )
    return WeightSummaryOut(
        unit=user.weight_unit,
        latest=_to_out(latest) if latest is not None else None,
        prior_week=_to_out(prior) if prior is not None else None,
        delta_kg=delta,
        current_target=_target_to_out(current_target) if current_target is not None else None,
        trend_kg=trend_kg,
        trend_delta_kg=trend_delta_kg,
        trend_lookback_days=weight_service.TREND_LOOKBACK_DAYS,
        trend_ready=trend_ready,
        starting_kg=starting_kg,
    )


@router.get("/trend", response_model=WeightTrendSeriesOut)
async def weight_trend(
    limit: int = 180,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> WeightTrendSeriesOut:
    limit = max(1, min(limit, 365))
    rows = await weight_service.list_history(db, user=user, limit=limit)
    if not rows:
        return WeightTrendSeriesOut(unit=user.weight_unit, points=[])
    oldest_first = list(reversed(rows))
    series = weight_service.compute_ewma_trend(oldest_first)
    points = [
        WeightTrendPoint(
            occurred_at=entry.occurred_at,
            weight_kg=entry.weight_kg,
            trend_kg=trend.quantize(Decimal("0.01")),
        )
        for entry, (_, trend) in zip(oldest_first, series, strict=True)
    ]
    return WeightTrendSeriesOut(unit=user.weight_unit, points=points)


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
    # This log may cross a title threshold; flag for a re-scan on the next /me
    # so the unlock surfaces immediately rather than on the 24h lazy scan.
    user.titles_last_scan_at = None
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


@router.patch("/{entry_id}", response_model=WeightEntryOut)
async def update_weight(
    entry_id: int,
    payload: WeightEntryPatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> WeightEntryOut:
    row = await weight_service.update_entry(
        db, user=user, entry_id=entry_id, patch=payload
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="weight.update",
        user_id=user.id,
        target_type="weight_entry",
        target_id=str(row.id),
        meta={"fields": list(payload.model_dump(exclude_unset=True).keys())},
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


# --- targets (history-tracked) ----------------------------------------------

@router.get("/targets", response_model=list[WeightTargetOut])
async def list_weight_targets(
    limit: int = 90,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WeightTargetOut]:
    limit = max(1, min(limit, 365))
    rows = await weight_service.list_targets(db, user=user, limit=limit)
    return [_target_to_out(r) for r in rows]


@router.get("/targets/current", response_model=WeightTargetOut | None)
async def get_current_target(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> WeightTargetOut | None:
    row = await weight_service.current_target(db, user=user)
    return _target_to_out(row) if row is not None else None


@router.post("/targets", response_model=WeightTargetOut, status_code=status.HTTP_201_CREATED)
async def add_weight_target(
    payload: WeightTargetIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> WeightTargetOut:
    # Range-check non-null values here so that an explicit "no target" (null)
    # still passes through to clear the goal.
    if payload.target_kg is not None and (
        payload.target_kg <= 0 or payload.target_kg >= 1000
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="target_kg must be in (0, 1000) or null",
        )
    row = await weight_service.add_target(
        db,
        user=user,
        target_kg=payload.target_kg,
        effective_at=payload.effective_at,
    )
    await audit(
        db,
        actor=f"user:{user.id}",
        action="weight.target.set",
        user_id=user.id,
        target_type="weight_target",
        target_id=str(row.id),
        meta={"target_kg": str(row.target_kg) if row.target_kg is not None else None},
    )
    return _target_to_out(row)


@router.delete("/targets/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_weight_target(
    target_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await weight_service.delete_target(db, user=user, target_id=target_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="weight.target.delete",
        user_id=user.id,
        target_type="weight_target",
        target_id=str(target_id),
    )
