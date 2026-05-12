from __future__ import annotations

from datetime import date

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.food_entry import FoodEntry
from app.models.user import User
from app.providers.food import food_providers
from app.schemas.food import (
    FoodAddIn,
    FoodAddOut,
    FoodEntryOut,
    FoodGoalOut,
    FoodGoalUpdate,
    FoodMacroTotals,
    FoodSearchHit,
    FoodSearchOut,
    FoodTodayOut,
)
from app.services import food_service, goal_service
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
        meal_type=e.meal_type,
        source=e.source,
        provider=e.provider,
        provider_id=e.provider_id,
        occurred_at=e.occurred_at,
        client_id=e.client_id,
    )


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
    entries = await food_service.list_today(db, user=user, for_date=day)
    target_kcal = int(goal.target)
    pct = min(999, round((total / target_kcal) * 100)) if target_kcal else 0
    return FoodTodayOut(
        date=day.isoformat(),
        total_kcal=total,
        target_kcal=target_kcal,
        percent=pct,
        over_target=total > target_kcal,
        remaining_kcal=target_kcal - total,
        macros=FoodMacroTotals(protein_g=protein, carbs_g=carbs, fat_g=fat),
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
        },
    )
    return FoodAddOut(
        entry=_entry_out(result.entry),
        total_kcal=result.total_kcal,
        target_kcal=result.target_kcal,
        xp_delta=result.xp_delta,
        over_target=result.over_target,
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
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Open Food Facts returned {exc.response.status_code}",
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
            kcal_per_100g=it.kcal_per_100g,
            protein_per_100g=it.protein_g,
            carbs_per_100g=it.carbs_g,
            fat_per_100g=it.fat_g,
        )
        for it in items
    ]
    return FoodSearchOut(query=q, hits=hits)
