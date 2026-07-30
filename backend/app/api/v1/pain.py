from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.pain_entry import PainEntry
from app.models.symptom_catalog import SymptomCatalog
from app.models.user import User
from app.schemas.pain import (
    PainEntryIn,
    PainEntryOut,
    PainEntryPatch,
    PainSummaryOut,
    SymptomCatalogIn,
    SymptomCatalogOut,
    SymptomCatalogPatch,
    SymptomLogOut,
    SymptomReorderIn,
)
from app.services import pain_service
from app.services.pain_service import InvalidPain
from app.telemetry.recorder import audit

router = APIRouter(prefix="/pain", tags=["pain"])


def _catalog_to_out(row: SymptomCatalog) -> SymptomCatalogOut:
    return SymptomCatalogOut(id=row.id, name=row.name, sort_order=row.sort_order)


def _entry_to_out(entry: PainEntry, names: dict[int, str]) -> PainEntryOut:
    return PainEntryOut(
        id=entry.id,
        pain_level=entry.pain_level,
        occurred_at=entry.occurred_at,
        note=entry.note,
        locations=[loc.region_key for loc in entry.locations],
        symptoms=[
            SymptomLogOut(
                id=s.id,
                catalog_id=s.catalog_id,
                name=names.get(s.catalog_id, "(removed)"),
                severity=s.severity,
                duration_minutes=s.duration_minutes,
            )
            for s in entry.symptoms
        ],
    )


# --- symptom catalog -------------------------------------------------------

@router.get("/symptoms", response_model=list[SymptomCatalogOut])
async def list_symptoms(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[SymptomCatalogOut]:
    rows = await pain_service.list_catalog(db, user=user)
    return [_catalog_to_out(r) for r in rows]


@router.post(
    "/symptoms", response_model=SymptomCatalogOut, status_code=status.HTTP_201_CREATED
)
async def add_symptom(
    payload: SymptomCatalogIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> SymptomCatalogOut:
    row = await pain_service.add_catalog(db, user=user, name=payload.name)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="pain.symptom.add",
        user_id=user.id,
        target_type="symptom_catalog",
        target_id=str(row.id),
        meta={"name": row.name},
    )
    return _catalog_to_out(row)


@router.post("/symptoms/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_symptoms(
    payload: SymptomReorderIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await pain_service.reorder_catalog(db, user=user, ids=payload.ids)


@router.patch("/symptoms/{catalog_id}", response_model=SymptomCatalogOut)
async def rename_symptom(
    catalog_id: int,
    payload: SymptomCatalogPatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> SymptomCatalogOut:
    row = await pain_service.rename_catalog(
        db, user=user, catalog_id=catalog_id, name=payload.name
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return _catalog_to_out(row)


@router.delete("/symptoms/{catalog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_symptom(
    catalog_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await pain_service.archive_catalog(db, user=user, catalog_id=catalog_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")


# --- pain entries ----------------------------------------------------------

@router.get("/summary", response_model=PainSummaryOut)
async def pain_summary(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> PainSummaryOut:
    latest = await pain_service.latest(db, user=user)
    if latest is None:
        return PainSummaryOut(latest=None)
    names = await pain_service.catalog_names(db, user=user)
    return PainSummaryOut(latest=_entry_to_out(latest, names))


@router.get("", response_model=list[PainEntryOut])
async def list_pain(
    limit: int = 90,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PainEntryOut]:
    limit = max(1, min(limit, 365))
    rows = await pain_service.list_history(db, user=user, limit=limit)
    names = await pain_service.catalog_names(db, user=user)
    return [_entry_to_out(r, names) for r in rows]


@router.post("", response_model=PainEntryOut, status_code=status.HTTP_201_CREATED)
async def add_pain(
    payload: PainEntryIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> PainEntryOut:
    try:
        entry = await pain_service.add_entry(
            db,
            user=user,
            pain_level=payload.pain_level,
            occurred_at=payload.occurred_at,
            note=payload.note,
            locations=list(payload.locations),
            symptoms=list(payload.symptoms),
        )
    except InvalidPain as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.code) from e
    await audit(
        db,
        actor=f"user:{user.id}",
        action="pain.add",
        user_id=user.id,
        target_type="pain_entry",
        target_id=str(entry.id),
        meta={"pain_level": entry.pain_level},
    )
    names = await pain_service.catalog_names(db, user=user)
    return _entry_to_out(entry, names)


@router.patch("/{entry_id}", response_model=PainEntryOut)
async def update_pain(
    entry_id: int,
    payload: PainEntryPatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> PainEntryOut:
    try:
        entry = await pain_service.update_entry(
            db, user=user, entry_id=entry_id, patch=payload
        )
    except InvalidPain as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.code) from e
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="pain.update",
        user_id=user.id,
        target_type="pain_entry",
        target_id=str(entry.id),
        meta={"fields": sorted(payload.model_fields_set)},
    )
    names = await pain_service.catalog_names(db, user=user)
    return _entry_to_out(entry, names)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pain(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await pain_service.delete_entry(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="pain.delete",
        user_id=user.id,
        target_type="pain_entry",
        target_id=str(entry_id),
    )
