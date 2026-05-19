from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.food import MealType, NutrientPanel

IngredientUnit = Literal["g", "ml", "serving"]


class RecipeIngredientIn(BaseModel):
    """Pre-multiplied snapshot for one ingredient. The frontend resolves
    serving/per-100 math via `lib/food/portionMath.ts` and sends the final
    kcal/macros/nutrients here — same contract as `FoodAddIn`."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=120)
    brand: str | None = Field(default=None, max_length=120)
    provider: str | None = Field(default=None, max_length=32)
    provider_id: str | None = Field(default=None, max_length=64)
    quantity: Decimal = Field(..., gt=0, le=100000)
    unit: IngredientUnit
    serving_g: Decimal | None = Field(default=None, ge=0, le=100000)
    serving_label: str | None = Field(default=None, max_length=64)
    kcal: int = Field(..., ge=0, le=20000)
    protein_g: Decimal | None = Field(default=None, ge=0, le=2000)
    carbs_g: Decimal | None = Field(default=None, ge=0, le=2000)
    fat_g: Decimal | None = Field(default=None, ge=0, le=2000)
    nutrients: NutrientPanel | None = None


class RecipeIngredientOut(BaseModel):
    id: uuid.UUID
    position: int
    name: str
    brand: str | None = None
    provider: str | None = None
    provider_id: str | None = None
    quantity: Decimal
    unit: IngredientUnit
    serving_g: Decimal | None = None
    serving_label: str | None = None
    kcal: int
    protein_g: Decimal | None = None
    carbs_g: Decimal | None = None
    fat_g: Decimal | None = None
    nutrients: dict[str, float] | None = None


class RecipeIn(BaseModel):
    """Full create/replace payload. PATCH uses the same shape — see
    `food_recipe_service.update` for the truncate-and-reinsert behaviour
    on the ingredients list."""

    model_config = ConfigDict(extra="forbid")

    label: str = Field(..., min_length=1, max_length=120)
    brand: str | None = Field(default=None, max_length=120)
    yields_servings: Decimal = Field(..., gt=0, le=1000)
    serving_label: str | None = Field(default=None, max_length=64)
    meal_type: MealType | None = None
    sort_order: int = 0
    ingredients: list[RecipeIngredientIn] = Field(..., min_length=1, max_length=50)


class RecipeOut(BaseModel):
    id: uuid.UUID
    label: str
    brand: str | None = None
    yields_servings: Decimal
    serving_label: str | None = None
    total_kcal: int
    total_protein_g: Decimal | None = None
    total_carbs_g: Decimal | None = None
    total_fat_g: Decimal | None = None
    total_nutrients: dict[str, float] | None = None
    meal_type: MealType | None = None
    sort_order: int
    ingredients: list[RecipeIngredientOut]
    created_at: datetime
    updated_at: datetime


class RecipeListItemOut(BaseModel):
    """List endpoint omits ingredients to keep the payload small. The detail
    GET returns the full `RecipeOut`."""

    id: uuid.UUID
    label: str
    brand: str | None = None
    yields_servings: Decimal
    serving_label: str | None = None
    total_kcal: int
    total_protein_g: Decimal | None = None
    total_carbs_g: Decimal | None = None
    total_fat_g: Decimal | None = None
    total_nutrients: dict[str, float] | None = None
    meal_type: MealType | None = None
    sort_order: int


class RecipeLogIn(BaseModel):
    """Log `servings` portions of this recipe as one `food_entries` row."""

    model_config = ConfigDict(extra="forbid")

    servings: Decimal = Field(..., gt=0, le=1000)
    meal_type: MealType | None = None
    occurred_at: datetime | None = None
    client_id: str | None = Field(default=None, max_length=120)
