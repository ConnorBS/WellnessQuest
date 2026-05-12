from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

MealType = Literal["breakfast", "lunch", "dinner", "snack"]
IconKind = Literal["builtin", "upload", "none"]
FoodUnit = Literal["g", "ml"]


class FoodAddIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    brand: str | None = Field(default=None, max_length=120)
    kcal: int = Field(..., ge=0, le=20000)
    protein_g: Decimal | None = Field(default=None, ge=0, le=2000)
    carbs_g: Decimal | None = Field(default=None, ge=0, le=2000)
    fat_g: Decimal | None = Field(default=None, ge=0, le=2000)
    meal_type: MealType | None = None
    provider: str | None = Field(default=None, max_length=32)
    provider_id: str | None = Field(default=None, max_length=64)
    client_id: str | None = Field(default=None, max_length=120)
    occurred_at: datetime | None = None


class FoodEntryOut(BaseModel):
    id: int
    name: str
    brand: str | None = None
    kcal: int
    protein_g: Decimal | None = None
    carbs_g: Decimal | None = None
    fat_g: Decimal | None = None
    meal_type: MealType | None = None
    source: str
    provider: str | None = None
    provider_id: str | None = None
    occurred_at: datetime
    client_id: str | None = None


class FoodMacroTotals(BaseModel):
    protein_g: Decimal
    carbs_g: Decimal
    fat_g: Decimal


class FoodTodayOut(BaseModel):
    date: str  # YYYY-MM-DD in user's tz
    total_kcal: int
    target_kcal: int  # daily ceiling
    percent: int  # of ceiling; can exceed 100
    over_target: bool
    remaining_kcal: int  # target_kcal - total_kcal (can be negative)
    macros: FoodMacroTotals
    entries: list[FoodEntryOut]


class FoodAddOut(BaseModel):
    entry: FoodEntryOut
    total_kcal: int
    target_kcal: int
    xp_delta: int
    over_target: bool


class FoodGoalUpdate(BaseModel):
    target_kcal: int = Field(..., gt=0, le=20000)


class FoodGoalOut(BaseModel):
    target_kcal: int


class FoodPresetIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=120)
    brand: str | None = Field(default=None, max_length=120)
    kcal: int = Field(..., ge=0, le=20000)
    protein_g: Decimal | None = Field(default=None, ge=0, le=2000)
    carbs_g: Decimal | None = Field(default=None, ge=0, le=2000)
    fat_g: Decimal | None = Field(default=None, ge=0, le=2000)
    meal_type: MealType | None = None
    provider: str | None = Field(default=None, max_length=32)
    provider_id: str | None = Field(default=None, max_length=64)
    icon_kind: IconKind = "none"
    icon_key: str | None = Field(default=None, max_length=64)
    sort_order: int = 0


class FoodPresetOut(BaseModel):
    id: uuid.UUID
    label: str
    brand: str | None = None
    kcal: int
    protein_g: Decimal | None = None
    carbs_g: Decimal | None = None
    fat_g: Decimal | None = None
    meal_type: MealType | None = None
    provider: str | None = None
    provider_id: str | None = None
    icon_kind: IconKind
    icon_key: str | None = None
    sort_order: int


class FoodSearchHit(BaseModel):
    provider: str
    provider_id: str
    name: str
    brand: str | None = None
    serving_g: float | None = None
    serving_label: str | None = None
    # "g" or "ml" if known. The frontend uses this to pick the unit picker
    # vocabulary (mass vs volume) and the matching per-100 nutriments.
    unit: Literal["g", "ml"] | None = None
    kcal_per_100g: float | None = None
    protein_per_100g: float | None = None
    carbs_per_100g: float | None = None
    fat_per_100g: float | None = None
    kcal_per_100ml: float | None = None
    protein_per_100ml: float | None = None
    carbs_per_100ml: float | None = None
    fat_per_100ml: float | None = None


class FoodSearchOut(BaseModel):
    query: str
    hits: list[FoodSearchHit]
