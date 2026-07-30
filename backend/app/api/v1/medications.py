from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.medication import MEDICATION_FORMS, Medication
from app.models.medication_change import (
    DOSE_UNITS,
    USER_CHANGE_KINDS,
    MedicationChange,
)
from app.models.user import User
from app.schemas.medication import (
    MedicationChangeFeedOut,
    MedicationChangeIn,
    MedicationChangeOut,
    MedicationDetailOut,
    MedicationIn,
    MedicationOptionsOut,
    MedicationOut,
    MedicationPatch,
    MedicationReorderIn,
    MedicationResumeIn,
    MedicationStopIn,
)
from app.services import medication_service
from app.services.medication_service import EMPTY_DOSE, CurrentDose, MedicationError
from app.services.time_utils import day_for_user
from app.telemetry.recorder import audit

router = APIRouter(prefix="/medications", tags=["medications"])


def _to_out(med: Medication, dose: CurrentDose, change_count: int) -> MedicationOut:
    return MedicationOut(
        id=med.id,
        name=med.name,
        form=med.form,
        reason=med.reason,
        prescriber=med.prescriber,
        notes=med.notes,
        started_on=med.started_on,
        ended_on=med.ended_on,
        stopped_reason=med.stopped_reason,
        sort_order=med.sort_order,
        active=med.ended_on is None,
        dose_amount=dose.dose_amount,
        dose_unit=dose.dose_unit,
        frequency=dose.frequency,
        change_count=change_count,
    )


def _change_out(row: MedicationChange) -> MedicationChangeOut:
    return MedicationChangeOut(
        id=row.id,
        medication_id=row.medication_id,
        kind=row.kind,
        effective_on=row.effective_on,
        dose_amount=row.dose_amount,
        dose_unit=row.dose_unit,
        frequency=row.frequency,
        note=row.note,
    )


def _bad(code: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=code)


def _check_form(form: str | None) -> None:
    if form is not None and form not in MEDICATION_FORMS:
        raise _bad("invalid_form")


async def _load(db: AsyncSession, user: User, med_id: int) -> Medication:
    med = await medication_service.get_medication(db, user=user, med_id=med_id)
    if med is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return med


async def _detail(db: AsyncSession, user: User, med: Medication) -> MedicationDetailOut:
    changes = await medication_service.list_changes(db, user=user, med_id=med.id)
    dose = medication_service.fold_current(changes)
    return MedicationDetailOut(
        **_to_out(med, dose, len(changes)).model_dump(),
        changes=[_change_out(c) for c in changes],
    )


# --- static routes first: "/options" and "/history" would otherwise be parsed
# --- as {med_id} and 422 on the int coercion.


@router.get("/options", response_model=MedicationOptionsOut)
async def options(
    user: User = Depends(current_user),
) -> MedicationOptionsOut:
    return MedicationOptionsOut(
        forms=list(MEDICATION_FORMS),
        dose_units=list(DOSE_UNITS),
        change_kinds=list(USER_CHANGE_KINDS),
    )


@router.get("/history", response_model=list[MedicationChangeFeedOut])
async def history(
    limit: int = Query(default=50, ge=1, le=500),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MedicationChangeFeedOut]:
    rows = await medication_service.history_feed(db, user=user, limit=limit)
    return [
        MedicationChangeFeedOut(
            **_change_out(row).model_dump(), medication_name=name
        )
        for row, name in rows
    ]


@router.get("", response_model=list[MedicationOut])
async def list_medications(
    status_: str = Query(default="all", alias="status", pattern="^(active|past|all)$"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MedicationOut]:
    meds = await medication_service.list_medications(db, user=user, status=status_)
    ids = [m.id for m in meds]
    doses = await medication_service.current_doses(db, user=user, med_ids=ids)
    counts = await medication_service.change_counts(db, user=user, med_ids=ids)
    return [
        _to_out(m, doses.get(m.id, EMPTY_DOSE), counts.get(m.id, 0)) for m in meds
    ]


@router.post("", response_model=MedicationDetailOut, status_code=status.HTTP_201_CREATED)
async def create_medication(
    payload: MedicationIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicationDetailOut:
    _check_form(payload.form)
    try:
        med = await medication_service.create(
            db,
            user=user,
            name=payload.name,
            today=day_for_user(user.timezone),
            form=payload.form,
            reason=payload.reason,
            prescriber=payload.prescriber,
            notes=payload.notes,
            started_on=payload.started_on,
            dose_amount=payload.dose_amount,
            dose_unit=payload.dose_unit,
            frequency=payload.frequency,
        )
    except MedicationError as exc:
        raise _bad(exc.code) from exc
    await audit(
        db,
        actor=f"user:{user.id}",
        action="medication.create",
        user_id=user.id,
        target_type="medication",
        target_id=str(med.id),
        meta={"name": med.name},
    )
    return await _detail(db, user, med)


@router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_medications(
    payload: MedicationReorderIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await medication_service.reorder(db, user=user, ids=payload.ids)


@router.get("/{med_id}", response_model=MedicationDetailOut)
async def get_medication(
    med_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicationDetailOut:
    med = await _load(db, user, med_id)
    return await _detail(db, user, med)


@router.patch("/{med_id}", response_model=MedicationDetailOut)
async def update_medication(
    med_id: int,
    payload: MedicationPatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicationDetailOut:
    med = await _load(db, user, med_id)
    fields = payload.model_fields_set
    if "form" in fields:
        _check_form(payload.form)
    if "started_on" in fields and payload.started_on is not None:
        if payload.started_on > day_for_user(user.timezone):
            raise _bad("future_date")
        if med.ended_on is not None and payload.started_on > med.ended_on:
            raise _bad("ended_before_started")
        med.started_on = payload.started_on
    for field in ("name", "form", "reason", "prescriber", "notes"):
        if field in fields:
            value = getattr(payload, field)
            if field == "name":
                if value is None:
                    continue
                value = value.strip()
            setattr(med, field, value)
    await db.flush()
    return await _detail(db, user, med)


@router.delete("/{med_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_medication(
    med_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    med = await _load(db, user, med_id)
    await medication_service.delete_medication(db, user=user, med=med)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="medication.delete",
        user_id=user.id,
        target_type="medication",
        target_id=str(med_id),
        meta={},
    )


# --- timeline --------------------------------------------------------------


@router.post(
    "/{med_id}/changes",
    response_model=MedicationDetailOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_change(
    med_id: int,
    payload: MedicationChangeIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicationDetailOut:
    if payload.kind not in USER_CHANGE_KINDS:
        raise _bad("invalid_kind")
    med = await _load(db, user, med_id)
    try:
        await medication_service.add_change(
            db,
            user=user,
            med=med,
            kind=payload.kind,
            today=day_for_user(user.timezone),
            effective_on=payload.effective_on,
            dose_amount=payload.dose_amount,
            dose_unit=payload.dose_unit,
            frequency=payload.frequency,
            note=payload.note,
        )
    except MedicationError as exc:
        raise _bad(exc.code) from exc
    return await _detail(db, user, med)


@router.delete("/{med_id}/changes/{change_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_change(
    med_id: int,
    change_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _load(db, user, med_id)
    try:
        found = await medication_service.delete_change(
            db, user=user, med_id=med_id, change_id=change_id
        )
    except MedicationError as exc:
        raise _bad(exc.code) from exc
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")


@router.post("/{med_id}/stop", response_model=MedicationDetailOut)
async def stop_medication(
    med_id: int,
    payload: MedicationStopIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicationDetailOut:
    med = await _load(db, user, med_id)
    try:
        await medication_service.stop(
            db,
            user=user,
            med=med,
            today=day_for_user(user.timezone),
            ended_on=payload.ended_on,
            reason=payload.reason,
        )
    except MedicationError as exc:
        raise _bad(exc.code) from exc
    await audit(
        db,
        actor=f"user:{user.id}",
        action="medication.stop",
        user_id=user.id,
        target_type="medication",
        target_id=str(med.id),
        meta={"ended_on": med.ended_on.isoformat() if med.ended_on else None},
    )
    return await _detail(db, user, med)


@router.post("/{med_id}/resume", response_model=MedicationDetailOut)
async def resume_medication(
    med_id: int,
    payload: MedicationResumeIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicationDetailOut:
    med = await _load(db, user, med_id)
    try:
        await medication_service.resume(
            db,
            user=user,
            med=med,
            today=day_for_user(user.timezone),
            effective_on=payload.effective_on,
            note=payload.note,
        )
    except MedicationError as exc:
        raise _bad(exc.code) from exc
    return await _detail(db, user, med)
