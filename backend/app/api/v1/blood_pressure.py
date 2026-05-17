from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.blood_pressure_entry import BloodPressureEntry
from app.models.blood_pressure_target import BloodPressureTarget
from app.models.user import User
from app.schemas.blood_pressure import (
    BloodPressureEntryIn,
    BloodPressureEntryOut,
    BloodPressureSummaryOut,
    BloodPressureTargetIn,
    BloodPressureTargetOut,
)
from app.services import blood_pressure_service
from app.services.time_utils import utcnow
from app.telemetry.recorder import audit

router = APIRouter(prefix="/blood-pressure", tags=["blood-pressure"])


def _to_out(row: BloodPressureEntry) -> BloodPressureEntryOut:
    return BloodPressureEntryOut(
        id=row.id,
        systolic=row.systolic,
        diastolic=row.diastolic,
        pulse=row.pulse,
        occurred_at=row.occurred_at,
        note=row.note,
    )


def _target_to_out(row: BloodPressureTarget) -> BloodPressureTargetOut:
    return BloodPressureTargetOut(
        id=row.id,
        target_systolic=row.target_systolic,
        target_diastolic=row.target_diastolic,
        effective_at=row.effective_at,
    )


@router.get("/summary", response_model=BloodPressureSummaryOut)
async def bp_summary(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> BloodPressureSummaryOut:
    latest = await blood_pressure_service.latest(db, user=user)
    current_target = await blood_pressure_service.current_target(db, user=user)
    return BloodPressureSummaryOut(
        latest=_to_out(latest) if latest is not None else None,
        current_target=_target_to_out(current_target) if current_target is not None else None,
    )


@router.get("", response_model=list[BloodPressureEntryOut])
async def list_history(
    limit: int = 90,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BloodPressureEntryOut]:
    limit = max(1, min(limit, 365))
    rows = await blood_pressure_service.list_history(db, user=user, limit=limit)
    return [_to_out(r) for r in rows]


@router.post(
    "", response_model=BloodPressureEntryOut, status_code=status.HTTP_201_CREATED
)
async def add_bp(
    payload: BloodPressureEntryIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> BloodPressureEntryOut:
    row = await blood_pressure_service.add(
        db,
        user=user,
        systolic=payload.systolic,
        diastolic=payload.diastolic,
        pulse=payload.pulse,
        occurred_at=payload.occurred_at or utcnow(),
        note=payload.note,
    )
    await audit(
        db,
        actor=f"user:{user.id}",
        action="blood_pressure.add",
        user_id=user.id,
        target_type="blood_pressure_entry",
        target_id=str(row.id),
        meta={
            "systolic": row.systolic,
            "diastolic": row.diastolic,
            "pulse": row.pulse,
        },
    )
    return _to_out(row)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bp(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await blood_pressure_service.delete(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="blood_pressure.delete",
        user_id=user.id,
        target_type="blood_pressure_entry",
        target_id=str(entry_id),
    )


# --- targets ---------------------------------------------------------------

@router.get("/targets", response_model=list[BloodPressureTargetOut])
async def list_bp_targets(
    limit: int = 90,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BloodPressureTargetOut]:
    limit = max(1, min(limit, 365))
    rows = await blood_pressure_service.list_targets(db, user=user, limit=limit)
    return [_target_to_out(r) for r in rows]


@router.get("/targets/current", response_model=BloodPressureTargetOut | None)
async def get_current_bp_target(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> BloodPressureTargetOut | None:
    row = await blood_pressure_service.current_target(db, user=user)
    return _target_to_out(row) if row is not None else None


@router.post(
    "/targets",
    response_model=BloodPressureTargetOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_bp_target(
    payload: BloodPressureTargetIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> BloodPressureTargetOut:
    row = await blood_pressure_service.add_target(
        db,
        user=user,
        target_systolic=payload.target_systolic,
        target_diastolic=payload.target_diastolic,
        effective_at=payload.effective_at,
    )
    await audit(
        db,
        actor=f"user:{user.id}",
        action="blood_pressure.target.set",
        user_id=user.id,
        target_type="blood_pressure_target",
        target_id=str(row.id),
        meta={
            "target_systolic": row.target_systolic,
            "target_diastolic": row.target_diastolic,
        },
    )
    return _target_to_out(row)


@router.delete("/targets/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bp_target(
    target_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await blood_pressure_service.delete_target(db, user=user, target_id=target_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="blood_pressure.target.delete",
        user_id=user.id,
        target_type="blood_pressure_target",
        target_id=str(target_id),
    )
