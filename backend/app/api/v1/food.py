from __future__ import annotations

from datetime import date

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, status
from fastapi import UploadFile as FastAPIUploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.food_entry import FoodEntry
from app.models.user import User
from app.providers.food import food_providers
from app.schemas.food import (
    DailyValuesOut,
    FoodAddIn,
    FoodAddOut,
    FoodEntryOut,
    FoodEntryPatch,
    FoodGoalOut,
    FoodGoalUpdate,
    FoodMacroTotals,
    FoodPatchOut,
    FoodRecentEntry,
    FoodSearchHit,
    FoodSearchOut,
    FoodTodayOut,
    LabelScanOut,
    daily_values_out,
)
from app.services import canadian_dv, food_service, goal_service, label_ocr_service
from app.services.label_ocr_service import LabelOcrError
from app.services.time_utils import day_for_user
from app.telemetry.logger import get_logger
from app.telemetry.recorder import audit, capture_error

log = get_logger(__name__)

router = APIRouter(prefix="/food", tags=["food"])


def _entry_out(e: FoodEntry) -> FoodEntryOut:
    return FoodEntryOut(
        id=e.id,
        name=e.name,
        brand=e.brand,
        kcal=e.kcal,
        protein_g=e.protein_g,
        carbs_g=e.carbs_g,
        fat_g=e.fat_g,
        servings=e.servings,
        serving_g=e.serving_g,
        serving_label=e.serving_label,
        nutrients=e.nutrients,
        meal_type=e.meal_type,
        source=e.source,
        provider=e.provider,
        provider_id=e.provider_id,
        occurred_at=e.occurred_at,
        client_id=e.client_id,
    )


@router.get("/daily-values", response_model=DailyValuesOut)
async def get_daily_values(
    _user: User = Depends(current_user),
) -> DailyValuesOut:
    """Health Canada Daily Values + nutrient classification map.

    Static — the frontend caches indefinitely. Authenticated so the endpoint
    isn't a free DV mirror, not because the data is sensitive.
    """
    return daily_values_out()


@router.patch("/goal", response_model=FoodGoalOut)
async def update_food_goal(
    payload: FoodGoalUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FoodGoalOut:
    goal = await goal_service.get_or_create_default_food(db, user_id=user.id)
    goal.target = payload.target_kcal
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="food.goal.update",
        user_id=user.id,
        target_type="goal",
        target_id=str(goal.id),
        meta={"target_kcal": payload.target_kcal},
    )
    return FoodGoalOut(target_kcal=int(goal.target))


@router.get("/today", response_model=FoodTodayOut)
async def food_today(
    date_: date | None = Query(default=None, alias="date"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FoodTodayOut:
    day = date_ or day_for_user(user.timezone)
    goal = await goal_service.get_or_create_default_food(db, user_id=user.id)
    total = await food_service.total_today(db, user=user, for_date=day)
    protein, carbs, fat = await food_service.macro_totals(db, user=user, for_date=day)
    nutrients_total = await food_service.nutrient_totals(db, user=user, for_date=day)
    entries = await food_service.list_today(db, user=user, for_date=day)
    target_kcal = int(goal.target)
    pct = min(999, round((total / target_kcal) * 100)) if target_kcal else 0
    # Build the full inputs to compute_dv_percent — macros (typed columns)
    # plus the JSONB nutrients sums plus kcal so the frontend can also
    # render the kcal DV consistently with everything else.
    dv_inputs: dict[str, float] = {
        "kcal": float(total),
        "protein_g": float(protein),
        "carbs_g": float(carbs),
        "fat_g": float(fat),
        **nutrients_total,
    }
    dv_percent = canadian_dv.compute_dv_percent(dv_inputs)
    return FoodTodayOut(
        date=day.isoformat(),
        total_kcal=total,
        target_kcal=target_kcal,
        percent=pct,
        over_target=total > target_kcal,
        remaining_kcal=target_kcal - total,
        macros=FoodMacroTotals(protein_g=protein, carbs_g=carbs, fat_g=fat),
        nutrients_total=nutrients_total,
        dv_percent=dv_percent,
        entries=[_entry_out(e) for e in entries],
    )


@router.post("", response_model=FoodAddOut, status_code=status.HTTP_201_CREATED)
async def add_food(
    payload: FoodAddIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FoodAddOut:
    result = await food_service.add(
        db,
        user=user,
        name=payload.name,
        brand=payload.brand,
        kcal=payload.kcal,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
        servings=payload.servings,
        serving_g=payload.serving_g,
        serving_label=payload.serving_label,
        nutrients=payload.nutrients.to_storage_dict() if payload.nutrients else None,
        meal_type=payload.meal_type,
        provider=payload.provider,
        provider_id=payload.provider_id,
        source="pwa",
        client_id=payload.client_id,
        occurred_at=payload.occurred_at,
    )
    await audit(
        db,
        actor=f"user:{user.id}",
        action="food.add",
        user_id=user.id,
        target_type="food_entry",
        target_id=str(result.entry.id),
        meta={
            "kcal": payload.kcal,
            "name": payload.name,
            "meal_type": payload.meal_type,
            "source": "pwa",
            "client_id": payload.client_id,
            "provider": payload.provider,
            "provider_id": payload.provider_id,
            "servings": str(payload.servings) if payload.servings is not None else None,
        },
    )
    return FoodAddOut(
        entry=_entry_out(result.entry),
        total_kcal=result.total_kcal,
        target_kcal=result.target_kcal,
        xp_delta=result.xp_delta,
        over_target=result.over_target,
    )


@router.patch("/{entry_id}", response_model=FoodPatchOut)
async def update_food(
    entry_id: int,
    payload: FoodEntryPatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FoodPatchOut:
    entry = await food_service.update_entry(db, user=user, entry_id=entry_id, patch=payload)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    goal = await goal_service.get_or_create_default_food(db, user_id=user.id)
    total = await food_service.total_today(db, user=user)
    target_kcal = int(goal.target)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="food.update",
        user_id=user.id,
        target_type="food_entry",
        target_id=str(entry.id),
        meta={
            "fields": list(payload.model_dump(exclude_unset=True).keys()),
        },
    )
    return FoodPatchOut(
        entry=_entry_out(entry),
        total_kcal=total,
        target_kcal=target_kcal,
        over_target=total > target_kcal,
    )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_food(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await food_service.delete(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="food.delete",
        user_id=user.id,
        target_type="food_entry",
        target_id=str(entry_id),
    )


@router.get("/recent", response_model=list[FoodRecentEntry])
async def food_recent(
    limit: int = Query(default=8, ge=1, le=20),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FoodRecentEntry]:
    """Most recently logged distinct foods for one-tap re-logging."""
    rows = await food_service.recent_distinct(db, user=user, limit=limit)
    return [
        FoodRecentEntry(
            name=r.name,
            brand=r.brand,
            kcal=r.kcal,
            protein_g=r.protein_g,
            carbs_g=r.carbs_g,
            fat_g=r.fat_g,
            servings=r.servings,
            serving_g=r.serving_g,
            serving_label=r.serving_label,
            nutrients=r.nutrients,
            meal_type=r.meal_type,
            provider=r.provider,
            provider_id=r.provider_id,
            last_logged_at=r.occurred_at,
        )
        for r in rows
    ]


@router.post("/scan-label", response_model=LabelScanOut)
async def scan_label(
    file: FastAPIUploadFile = File(...),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> LabelScanOut:
    """OCR a Canadian Nutrition Facts panel from a photo.

    Returns the parsed fields without creating any preset or entry — the UI
    drives a confirmation/edit screen and calls POST /food or POST
    /food/presets when the user is happy.
    """
    raw = await file.read()
    try:
        parsed = await label_ocr_service.scan(
            raw=raw,
            content_type=file.content_type or "application/octet-stream",
        )
    except LabelOcrError as exc:
        await capture_error(
            db,
            source="food.scan_label",
            level="warning",
            message=str(exc),
            context={"content_type": file.content_type, "size": len(raw)},
            user_id=user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    await audit(
        db,
        actor=f"user:{user.id}",
        action="food.scan_label",
        user_id=user.id,
        meta={
            "size_bytes": len(raw),
            "fields_found": sum(
                1 for v in parsed.nutrients.model_dump().values() if v is not None
            ),
        },
    )
    return parsed


@router.get("/search", response_model=FoodSearchOut)
async def food_search(
    q: str = Query(..., min_length=2, max_length=120),
    limit: int = Query(default=20, ge=1, le=50),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FoodSearchOut:
    """Search Open Food Facts. Authenticated to avoid being a public proxy."""
    provider_cls = food_providers.get("openfoodfacts")
    provider = provider_cls({})
    try:
        items = await provider.search(q, limit=limit)
    except httpx.HTTPStatusError as exc:
        await capture_error(
            db,
            source="food.search",
            level="warning",
            message=f"OFF returned {exc.response.status_code}",
            context={"query": q, "url": str(exc.request.url)},
            user_id=user.id,
        )
        # 5xx from OFF usually means a transient outage / rate limit on their
        # side. Surface a hint that retrying in a few seconds will likely work.
        if exc.response.status_code >= 500:
            detail = "Open Food Facts is temporarily unavailable. Try again in a few seconds."
        else:
            detail = f"Open Food Facts returned {exc.response.status_code}"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        ) from exc
    except httpx.HTTPError as exc:
        await capture_error(
            db,
            source="food.search",
            level="warning",
            message=f"OFF transport error: {type(exc).__name__}: {exc}",
            context={"query": q},
            user_id=user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach Open Food Facts ({type(exc).__name__})",
        ) from exc
    except Exception as exc:  # noqa: BLE001 - last-chance to surface a useful message
        await capture_error(
            db,
            source="food.search",
            level="error",
            message=f"OFF unexpected error: {type(exc).__name__}: {exc}",
            context={"query": q},
            user_id=user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Food search failed ({type(exc).__name__})",
        ) from exc
    hits = [
        FoodSearchHit(
            provider=it.source,
            provider_id=it.source_id,
            name=it.name,
            brand=it.brand,
            serving_g=it.serving_g,
            serving_label=it.serving_label,
            unit=it.unit,
            kcal_per_100g=it.kcal_per_100g,
            protein_per_100g=it.protein_per_100g,
            carbs_per_100g=it.carbs_per_100g,
            fat_per_100g=it.fat_per_100g,
            kcal_per_100ml=it.kcal_per_100ml,
            protein_per_100ml=it.protein_per_100ml,
            carbs_per_100ml=it.carbs_per_100ml,
            fat_per_100ml=it.fat_per_100ml,
            nutrients_per_100g=it.nutrients_per_100g,
        )
        for it in items
    ]
    return FoodSearchOut(query=q, hits=hits)


@router.get("/barcode/{code}", response_model=FoodSearchHit)
async def food_barcode(
    code: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FoodSearchHit:
    """Look up one product by barcode. Returns the same shape as a search hit
    so the frontend can route it through the existing select-and-log flow.
    """
    if not code.isdigit() or not (6 <= len(code) <= 14):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="bad_barcode"
        )
    provider_cls = food_providers.get("openfoodfacts")
    provider = provider_cls({})
    try:
        item = await provider.by_barcode(code)
    except httpx.HTTPError as exc:
        await capture_error(
            db,
            source="food.barcode",
            level="warning",
            message=f"OFF barcode lookup failed: {type(exc).__name__}: {exc}",
            context={"code": code},
            user_id=user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach Open Food Facts ({type(exc).__name__})",
        ) from exc
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No product with barcode {code} in Open Food Facts.",
        )
    return FoodSearchHit(
        provider=item.source,
        provider_id=item.source_id,
        name=item.name,
        brand=item.brand,
        serving_g=item.serving_g,
        serving_label=item.serving_label,
        unit=item.unit,
        kcal_per_100g=item.kcal_per_100g,
        protein_per_100g=item.protein_per_100g,
        carbs_per_100g=item.carbs_per_100g,
        fat_per_100g=item.fat_per_100g,
        kcal_per_100ml=item.kcal_per_100ml,
        protein_per_100ml=item.protein_per_100ml,
        carbs_per_100ml=item.carbs_per_100ml,
        fat_per_100ml=item.fat_per_100ml,
        nutrients_per_100g=item.nutrients_per_100g,
    )
