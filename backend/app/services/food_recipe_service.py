from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food_recipe import FoodRecipe
from app.models.food_recipe_ingredient import FoodRecipeIngredient
from app.models.user import User
from app.schemas.food_recipe import RecipeIn, RecipeIngredientIn
from app.services import food_service
from app.services.time_utils import utcnow

# Mirrors the CHECK on food_entries.kcal — a single recipe-log can't exceed
# the entry ceiling. We reject pre-flight rather than catching IntegrityError
# so the API returns a usable 422 instead of a 500-ish surprise.
_FOOD_ENTRY_KCAL_MAX = 20000


def _ingredient_to_row(ing: RecipeIngredientIn, position: int) -> FoodRecipeIngredient:
    """Map a `RecipeIngredientIn` into a SQLAlchemy row at `position`."""
    return FoodRecipeIngredient(
        position=position,
        name=ing.name.strip(),
        brand=(ing.brand.strip() or None) if ing.brand else None,
        provider=ing.provider,
        provider_id=ing.provider_id,
        quantity=ing.quantity,
        unit=ing.unit,
        serving_g=ing.serving_g,
        serving_label=(ing.serving_label.strip() or None) if ing.serving_label else None,
        kcal=ing.kcal,
        protein_g=ing.protein_g,
        carbs_g=ing.carbs_g,
        fat_g=ing.fat_g,
        nutrients=ing.nutrients.to_storage_dict() if ing.nutrients else None,
    )


def _sum_decimal(
    values: list[Decimal | None],
) -> Decimal | None:
    """Sum a list of Decimals treating missing entries as 0, but return None
    when EVERY entry is missing. Mirrors the "no data" vs "zero" distinction
    used elsewhere in the food schema."""
    if all(v is None for v in values):
        return None
    return sum((v for v in values if v is not None), Decimal(0))


def _merge_nutrients(blobs: list[dict[str, Any] | None]) -> dict[str, float] | None:
    """Sum JSONB nutrient blobs key-by-key. Missing key in a blob means
    "no data for this nutrient on this ingredient" (skip), not zero. Same
    semantics as `food_service.nutrient_totals()`."""
    totals: dict[str, float] = {}
    for blob in blobs:
        if not blob:
            continue
        for key, raw in blob.items():
            try:
                val = float(raw)
            except (TypeError, ValueError):
                continue
            totals[key] = totals.get(key, 0.0) + val
    if not totals:
        return None
    return {k: round(v, 3) for k, v in totals.items()}


def recompute_totals(recipe: FoodRecipe) -> None:
    """Recompute pre-aggregated totals on the recipe row from its ingredients.

    Pure SQLAlchemy state mutation — caller is responsible for the flush.
    Called on POST (create) and on every PATCH (always, even if only `label`
    changed: the helper is cheap and avoids branching on "did the caller
    send ingredients?")."""
    ings = list(recipe.ingredients)
    recipe.total_kcal = sum(i.kcal for i in ings)
    recipe.total_protein_g = _sum_decimal([i.protein_g for i in ings])
    recipe.total_carbs_g = _sum_decimal([i.carbs_g for i in ings])
    recipe.total_fat_g = _sum_decimal([i.fat_g for i in ings])
    recipe.total_nutrients = _merge_nutrients([i.nutrients for i in ings])


async def list_for_user(db: AsyncSession, *, user: User) -> list[FoodRecipe]:
    stmt = (
        select(FoodRecipe)
        .where(FoodRecipe.user_id == user.id)
        .order_by(FoodRecipe.sort_order, FoodRecipe.created_at)
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_owned(
    db: AsyncSession, *, user: User, recipe_id: uuid.UUID
) -> FoodRecipe:
    stmt = select(FoodRecipe).where(
        FoodRecipe.id == recipe_id, FoodRecipe.user_id == user.id
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return row


async def create(
    db: AsyncSession, *, user: User, payload: RecipeIn
) -> FoodRecipe:
    recipe = FoodRecipe(
        user_id=user.id,
        label=payload.label.strip(),
        brand=(payload.brand.strip() or None) if payload.brand else None,
        yields_servings=payload.yields_servings,
        serving_label=(payload.serving_label.strip() or None)
        if payload.serving_label
        else None,
        meal_type=payload.meal_type,
        sort_order=payload.sort_order,
    )
    for idx, ing in enumerate(payload.ingredients):
        recipe.ingredients.append(_ingredient_to_row(ing, idx))
    recompute_totals(recipe)
    db.add(recipe)
    await db.flush()
    return recipe


async def update(
    db: AsyncSession, *, user: User, recipe_id: uuid.UUID, payload: RecipeIn
) -> FoodRecipe:
    recipe = await get_owned(db, user=user, recipe_id=recipe_id)
    recipe.label = payload.label.strip()
    recipe.brand = (payload.brand.strip() or None) if payload.brand else None
    recipe.yields_servings = payload.yields_servings
    recipe.serving_label = (
        (payload.serving_label.strip() or None) if payload.serving_label else None
    )
    recipe.meal_type = payload.meal_type
    recipe.sort_order = payload.sort_order
    recipe.updated_at = utcnow()

    # Full-replace the ingredient list. The unique (recipe_id, position)
    # constraint means we can't lazily upsert positions — easier to nuke
    # and re-insert inside the same transaction.
    await db.execute(
        delete(FoodRecipeIngredient).where(
            FoodRecipeIngredient.recipe_id == recipe.id
        )
    )
    recipe.ingredients = []
    for idx, ing in enumerate(payload.ingredients):
        recipe.ingredients.append(_ingredient_to_row(ing, idx))
    recompute_totals(recipe)
    await db.flush()
    return recipe


async def delete_recipe(
    db: AsyncSession, *, user: User, recipe_id: uuid.UUID
) -> None:
    recipe = await get_owned(db, user=user, recipe_id=recipe_id)
    await db.delete(recipe)


def _scale_decimal(value: Decimal | None, factor: Decimal) -> Decimal | None:
    if value is None:
        return None
    return (value * factor).quantize(Decimal("0.01"))


def _scale_nutrients(
    blob: dict[str, Any] | None, factor: Decimal
) -> dict[str, float] | None:
    if not blob:
        return None
    f = float(factor)
    out: dict[str, float] = {}
    for key, raw in blob.items():
        try:
            val = float(raw)
        except (TypeError, ValueError):
            continue
        out[key] = round(val * f, 3)
    return out or None


async def log_recipe(
    db: AsyncSession,
    *,
    user: User,
    recipe_id: uuid.UUID,
    servings: Decimal,
    meal_type: str | None,
    occurred_at: datetime | None,
    client_id: str | None,
) -> food_service.FoodAddResult:
    """Log `servings` portions of a recipe as a single `food_entries` row.

    Multiplies the recipe's pre-aggregated totals by `servings /
    yields_servings`, then delegates to `food_service.add()` so XP grant,
    idempotency, and the `food.target_exceeded` event behave identically
    to any other food log. Note: pre-aggregated totals × factor introduces
    double-rounding (sub-1-kcal drift on small fractions); acceptable.
    """
    recipe = await get_owned(db, user=user, recipe_id=recipe_id)
    factor = servings / recipe.yields_servings

    scaled_kcal = int(round(recipe.total_kcal * float(factor)))
    if scaled_kcal > _FOOD_ENTRY_KCAL_MAX:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="recipe_log_too_large",
        )

    return await food_service.add(
        db,
        user=user,
        name=recipe.label,
        brand=recipe.brand,
        kcal=scaled_kcal,
        protein_g=_scale_decimal(recipe.total_protein_g, factor),
        carbs_g=_scale_decimal(recipe.total_carbs_g, factor),
        fat_g=_scale_decimal(recipe.total_fat_g, factor),
        servings=servings,
        serving_g=None,
        serving_label=recipe.serving_label,
        nutrients=_scale_nutrients(recipe.total_nutrients, factor),
        meal_type=meal_type or recipe.meal_type,
        source="pwa",
        provider="recipe",
        provider_id=str(recipe.id),
        client_id=client_id,
        occurred_at=occurred_at,
    )
