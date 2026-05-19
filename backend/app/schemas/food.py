from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.services.canadian_dv import CANADIAN_DV, NUTRIENT_META

MealType = Literal["breakfast", "lunch", "dinner", "snack"]
IconKind = Literal["builtin", "upload", "none"]
FoodUnit = Literal["g", "ml"]

# Whitelist for the `nutrients` JSONB blob. Adding a key here makes it
# acceptable from the API and shows up in totals; the migration doesn't
# need to change (JSONB).
ALLOWED_NUTRIENT_KEYS = frozenset(NUTRIENT_META.keys()) - {"kcal"}


class NutrientPanel(BaseModel):
    """Per-portion Canadian Nutrition Facts values. All fields optional; the
    panel is meaningful even when only some rows are known (e.g. OFF often
    lacks vitamins). Keys outside ALLOWED_NUTRIENT_KEYS are rejected."""

    model_config = ConfigDict(extra="forbid")

    saturated_fat_g: float | None = Field(default=None, ge=0, le=2000)
    trans_fat_g: float | None = Field(default=None, ge=0, le=2000)
    saturated_trans_g: float | None = Field(default=None, ge=0, le=2000)
    fibre_g: float | None = Field(default=None, ge=0, le=2000)
    sugars_g: float | None = Field(default=None, ge=0, le=2000)
    cholesterol_mg: float | None = Field(default=None, ge=0, le=100000)
    sodium_mg: float | None = Field(default=None, ge=0, le=100000)
    potassium_mg: float | None = Field(default=None, ge=0, le=100000)
    calcium_mg: float | None = Field(default=None, ge=0, le=100000)
    iron_mg: float | None = Field(default=None, ge=0, le=1000)
    vit_a_mcg_rae: float | None = Field(default=None, ge=0, le=100000)
    vit_c_mg: float | None = Field(default=None, ge=0, le=100000)
    vit_d_mcg: float | None = Field(default=None, ge=0, le=10000)
    vit_e_mg: float | None = Field(default=None, ge=0, le=10000)
    vit_k_mcg: float | None = Field(default=None, ge=0, le=100000)
    thiamin_mg: float | None = Field(default=None, ge=0, le=1000)
    riboflavin_mg: float | None = Field(default=None, ge=0, le=1000)
    niacin_mg: float | None = Field(default=None, ge=0, le=1000)
    vit_b6_mg: float | None = Field(default=None, ge=0, le=1000)
    folate_mcg_dfe: float | None = Field(default=None, ge=0, le=100000)
    vit_b12_mcg: float | None = Field(default=None, ge=0, le=10000)
    pantothenate_mg: float | None = Field(default=None, ge=0, le=1000)
    phosphorus_mg: float | None = Field(default=None, ge=0, le=100000)
    magnesium_mg: float | None = Field(default=None, ge=0, le=100000)
    zinc_mg: float | None = Field(default=None, ge=0, le=1000)

    def to_storage_dict(self) -> dict[str, float] | None:
        """Drop None entries before storing — JSONB keys-with-null wastes space
        and confuses sum-on-read. Returns None when nothing is set."""
        out = {k: v for k, v in self.model_dump().items() if v is not None}
        return out if out else None


class FoodAddIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    brand: str | None = Field(default=None, max_length=120)
    kcal: int = Field(..., ge=0, le=20000)
    protein_g: Decimal | None = Field(default=None, ge=0, le=2000)
    carbs_g: Decimal | None = Field(default=None, ge=0, le=2000)
    fat_g: Decimal | None = Field(default=None, ge=0, le=2000)
    # Servings + the serving size used to compute the kcal/macros above.
    # The backend stores these as a snapshot so editing the source preset
    # later doesn't rewrite history. kcal stays the source of truth for
    # totals; the structural fields drive the edit-after-log UX.
    servings: Decimal | None = Field(default=None, ge=0, le=1000)
    serving_g: Decimal | None = Field(default=None, ge=0, le=100000)
    serving_label: str | None = Field(default=None, max_length=64)
    nutrients: NutrientPanel | None = None
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
    servings: Decimal | None = None
    serving_g: Decimal | None = None
    serving_label: str | None = None
    nutrients: dict[str, float] | None = None
    meal_type: MealType | None = None
    source: str
    provider: str | None = None
    provider_id: str | None = None
    occurred_at: datetime
    client_id: str | None = None


class FoodEntryPatch(BaseModel):
    """All fields optional; only provided ones are updated. Editing `servings`
    alone doesn't re-multiply kcal/macros — the client is expected to send the
    final values too. The backend treats this as a passthrough edit, same
    contract as the original POST."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    brand: str | None = Field(default=None, max_length=120)
    kcal: int | None = Field(default=None, ge=0, le=20000)
    protein_g: Decimal | None = Field(default=None, ge=0, le=2000)
    carbs_g: Decimal | None = Field(default=None, ge=0, le=2000)
    fat_g: Decimal | None = Field(default=None, ge=0, le=2000)
    servings: Decimal | None = Field(default=None, ge=0, le=1000)
    serving_g: Decimal | None = Field(default=None, ge=0, le=100000)
    serving_label: str | None = Field(default=None, max_length=64)
    nutrients: NutrientPanel | None = None
    meal_type: MealType | None = None


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
    # Day-totals across all nutrient rows from the JSONB blobs. Keys are
    # a subset of ALLOWED_NUTRIENT_KEYS; missing = 0.
    nutrients_total: dict[str, float]
    # % of Canadian DV per nutrient (server-computed). Mirrors keys in
    # CANADIAN_DV; values may exceed 100.
    dv_percent: dict[str, float]
    entries: list[FoodEntryOut]


class FoodAddOut(BaseModel):
    entry: FoodEntryOut
    total_kcal: int
    target_kcal: int
    xp_delta: int
    over_target: bool


class FoodPatchOut(BaseModel):
    entry: FoodEntryOut
    total_kcal: int
    target_kcal: int
    over_target: bool


class FoodRecentEntry(BaseModel):
    """Shape the /food/recent endpoint returns. Carries everything a one-tap
    re-log needs — same fields a FoodPreset would, minus the icon/preset-id."""

    name: str
    brand: str | None = None
    kcal: int
    protein_g: Decimal | None = None
    carbs_g: Decimal | None = None
    fat_g: Decimal | None = None
    servings: Decimal | None = None
    serving_g: Decimal | None = None
    serving_label: str | None = None
    nutrients: dict[str, float] | None = None
    meal_type: MealType | None = None
    provider: str | None = None
    provider_id: str | None = None
    last_logged_at: datetime


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
    # Serving size that the kcal/macros above describe. Editable later
    # via PATCH; logged entries snapshot this at log time so edits don't
    # rewrite history.
    serving_g: Decimal | None = Field(default=None, ge=0, le=100000)
    serving_label: str | None = Field(default=None, max_length=64)
    nutrients: NutrientPanel | None = None
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
    serving_g: Decimal | None = None
    serving_label: str | None = None
    nutrients: dict[str, float] | None = None
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
    # Extended per-100 nutrient panel (mass basis only — OFF reports liquid
    # nutriments under _100ml but the additional fields are sparse; the
    # frontend uses water-density fallback for mL when needed).
    nutrients_per_100g: dict[str, float] | None = None


class FoodSearchOut(BaseModel):
    query: str
    hits: list[FoodSearchHit]


class DailyValuesOut(BaseModel):
    """Health Canada DV reference + classification map. Served from
    GET /food/daily-values for the frontend to mirror without re-encoding."""

    values: dict[str, float]
    # nutrient_id -> { label, unit, kind: 'macro'|'encourage'|'limit' }
    meta: dict[str, dict[str, str]]


def daily_values_out() -> DailyValuesOut:
    return DailyValuesOut(
        values=dict(CANADIAN_DV),
        meta={k: {"label": m[0], "unit": m[1], "kind": m[2]} for k, m in NUTRIENT_META.items()},
    )


class LabelScanOut(BaseModel):
    """OCR'd label parse. All fields optional — the review screen forces the
    user to fill anything missing before saving. `raw_text` is included so the
    UI can show the source under a "show OCR" disclosure."""

    name: str | None = None
    brand: str | None = None
    serving_g: float | None = None
    serving_label: str | None = None
    kcal: int | None = None
    nutrients: NutrientPanel = NutrientPanel()
    raw_text: str
    language: Literal["en", "fr", "mixed"] = "mixed"
