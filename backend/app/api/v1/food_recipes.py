from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.food_recipe import FoodRecipe
from app.models.user import User
from app.schemas.food import FoodAddOut, FoodEntryOut
from app.schemas.food_recipe import (
    RecipeIn,
    RecipeIngredientOut,
    RecipeListItemOut,
    RecipeLogIn,
    RecipeOut,
)
from app.services import food_recipe_service
from app.telemetry.recorder import audit

router = APIRouter(prefix="/food/recipes", tags=["food"])


def _ingredient_out(i) -> RecipeIngredientOut:
    return RecipeIngredientOut(
        id=i.id,
        position=i.position,
        name=i.name,
        brand=i.brand,
        provider=i.provider,
        provider_id=i.provider_id,
        quantity=i.quantity,
        unit=i.unit,
        serving_g=i.serving_g,
        serving_label=i.serving_label,
        kcal=i.kcal,
        protein_g=i.protein_g,
        carbs_g=i.carbs_g,
        fat_g=i.fat_g,
        nutrients=i.nutrients,
    )


def _recipe_out(r: FoodRecipe) -> RecipeOut:
    return RecipeOut(
        id=r.id,
        label=r.label,
        brand=r.brand,
        yields_servings=r.yields_servings,
        serving_label=r.serving_label,
        total_kcal=r.total_kcal,
        total_protein_g=r.total_protein_g,
        total_carbs_g=r.total_carbs_g,
        total_fat_g=r.total_fat_g,
        total_nutrients=r.total_nutrients,
        meal_type=r.meal_type,
        sort_order=r.sort_order,
        ingredients=[_ingredient_out(i) for i in r.ingredients],
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


def _list_out(r: FoodRecipe) -> RecipeListItemOut:
    return RecipeListItemOut(
        id=r.id,
        label=r.label,
        brand=r.brand,
        yields_servings=r.yields_servings,
        serving_label=r.serving_label,
        total_kcal=r.total_kcal,
        total_protein_g=r.total_protein_g,
        total_carbs_g=r.total_carbs_g,
        total_fat_g=r.total_fat_g,
        total_nutrients=r.total_nutrients,
        meal_type=r.meal_type,
        sort_order=r.sort_order,
    )


@router.get("", response_model=list[RecipeListItemOut])
async def list_recipes(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[RecipeListItemOut]:
    rows = await food_recipe_service.list_for_user(db, user=user)
    return [_list_out(r) for r in rows]


@router.get("/{recipe_id}", response_model=RecipeOut)
async def get_recipe(
    recipe_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> RecipeOut:
    recipe = await food_recipe_service.get_owned(db, user=user, recipe_id=recipe_id)
    return _recipe_out(recipe)


@router.post("", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    payload: RecipeIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> RecipeOut:
    recipe = await food_recipe_service.create(db, user=user, payload=payload)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="food.recipe.create",
        user_id=user.id,
        target_type="food_recipe",
        target_id=str(recipe.id),
        meta={
            "label": recipe.label,
            "total_kcal": recipe.total_kcal,
            "ingredients": len(recipe.ingredients),
        },
    )
    return _recipe_out(recipe)


@router.patch("/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: uuid.UUID,
    payload: RecipeIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> RecipeOut:
    recipe = await food_recipe_service.update(
        db, user=user, recipe_id=recipe_id, payload=payload
    )
    await audit(
        db,
        actor=f"user:{user.id}",
        action="food.recipe.update",
        user_id=user.id,
        target_type="food_recipe",
        target_id=str(recipe.id),
    )
    return _recipe_out(recipe)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await food_recipe_service.delete_recipe(db, user=user, recipe_id=recipe_id)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="food.recipe.delete",
        user_id=user.id,
        target_type="food_recipe",
        target_id=str(recipe_id),
    )


@router.post(
    "/{recipe_id}/log",
    response_model=FoodAddOut,
    status_code=status.HTTP_201_CREATED,
)
async def log_recipe(
    recipe_id: uuid.UUID,
    payload: RecipeLogIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FoodAddOut:
    result = await food_recipe_service.log_recipe(
        db,
        user=user,
        recipe_id=recipe_id,
        servings=payload.servings,
        meal_type=payload.meal_type,
        occurred_at=payload.occurred_at,
        client_id=payload.client_id,
    )
    await audit(
        db,
        actor=f"user:{user.id}",
        action="food.recipe.log",
        user_id=user.id,
        target_type="food_recipe",
        target_id=str(recipe_id),
        meta={
            "servings": str(payload.servings),
            "kcal": result.entry.kcal,
            "entry_id": result.entry.id,
        },
    )
    entry = result.entry
    return FoodAddOut(
        entry=FoodEntryOut(
            id=entry.id,
            name=entry.name,
            brand=entry.brand,
            kcal=entry.kcal,
            protein_g=entry.protein_g,
            carbs_g=entry.carbs_g,
            fat_g=entry.fat_g,
            servings=entry.servings,
            serving_g=entry.serving_g,
            serving_label=entry.serving_label,
            nutrients=entry.nutrients,
            meal_type=entry.meal_type,
            source=entry.source,
            provider=entry.provider,
            provider_id=entry.provider_id,
            occurred_at=entry.occurred_at,
            client_id=entry.client_id,
        ),
        total_kcal=result.total_kcal,
        target_kcal=result.target_kcal,
        xp_delta=result.xp_delta,
        over_target=result.over_target,
    )
