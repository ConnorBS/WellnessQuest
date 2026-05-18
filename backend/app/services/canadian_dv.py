"""Health Canada Daily Values for the Nutrition Facts panel.

These are the numbers printed on every Canadian package's `% Daily Value`
column, per Schedule K of the Food and Drug Regulations (adult / child 4+
basis — Health Canada uses one set of DVs for the general population, not
age/sex-stratified DRIs). They're universal; we don't personalize per user.

Keep this list in sync with `frontend/src/lib/canadianDV.ts`. Adding a new
nutrient requires no migration since `food_entries.nutrients` is JSONB —
just whitelist the key here and in `schemas.food.NutrientPanel`.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Literal

NutrientKind = Literal["macro", "encourage", "limit"]

# Display label, base unit, classification. Used by the frontend for color
# coding; mirrored client-side via GET /food/daily-values.
NUTRIENT_META: dict[str, tuple[str, str, NutrientKind]] = {
    # Macros (just informational — not "good" or "bad")
    "kcal": ("Calories", "kcal", "macro"),
    "protein_g": ("Protein", "g", "macro"),
    "carbs_g": ("Carbohydrate", "g", "macro"),
    "fat_g": ("Fat", "g", "limit"),
    # Things to limit
    "saturated_fat_g": ("Saturated fat", "g", "limit"),
    "trans_fat_g": ("Trans fat", "g", "limit"),
    "saturated_trans_g": ("Saturated + trans", "g", "limit"),
    "cholesterol_mg": ("Cholesterol", "mg", "limit"),
    "sodium_mg": ("Sodium", "mg", "limit"),
    "sugars_g": ("Sugars", "g", "limit"),
    # Things to encourage
    "fibre_g": ("Fibre", "g", "encourage"),
    "potassium_mg": ("Potassium", "mg", "encourage"),
    "calcium_mg": ("Calcium", "mg", "encourage"),
    "iron_mg": ("Iron", "mg", "encourage"),
    "vit_a_mcg_rae": ("Vitamin A", "µg RAE", "encourage"),
    "vit_c_mg": ("Vitamin C", "mg", "encourage"),
    "vit_d_mcg": ("Vitamin D", "µg", "encourage"),
    "vit_e_mg": ("Vitamin E", "mg", "encourage"),
    "vit_k_mcg": ("Vitamin K", "µg", "encourage"),
    "thiamin_mg": ("Thiamin", "mg", "encourage"),
    "riboflavin_mg": ("Riboflavin", "mg", "encourage"),
    "niacin_mg": ("Niacin", "mg", "encourage"),
    "vit_b6_mg": ("Vitamin B6", "mg", "encourage"),
    "folate_mcg_dfe": ("Folate", "µg DFE", "encourage"),
    "vit_b12_mcg": ("Vitamin B12", "µg", "encourage"),
    "pantothenate_mg": ("Pantothenate", "mg", "encourage"),
    "phosphorus_mg": ("Phosphorus", "mg", "encourage"),
    "magnesium_mg": ("Magnesium", "mg", "encourage"),
    "zinc_mg": ("Zinc", "mg", "encourage"),
}

# Daily Values per Schedule K of the FDR (2016 revision, current as of 2026).
# kcal is included for symmetry — it's the reference intake on labels, not a
# nutrient DV in the legal sense.
CANADIAN_DV: dict[str, float] = {
    "kcal": 2000,
    "fat_g": 75,
    "saturated_trans_g": 20,
    "cholesterol_mg": 300,
    "sodium_mg": 2300,
    "carbs_g": 275,
    "fibre_g": 28,
    "sugars_g": 100,
    "protein_g": 50,
    "potassium_mg": 3400,
    "calcium_mg": 1300,
    "iron_mg": 18,
    "vit_a_mcg_rae": 900,
    "vit_c_mg": 90,
    "vit_d_mcg": 20,
    "vit_e_mg": 15,
    "vit_k_mcg": 120,
    "thiamin_mg": 1.2,
    "riboflavin_mg": 1.3,
    "niacin_mg": 16,
    "vit_b6_mg": 1.7,
    "folate_mcg_dfe": 400,
    "vit_b12_mcg": 2.4,
    "pantothenate_mg": 5,
    "phosphorus_mg": 1250,
    "magnesium_mg": 420,
    "zinc_mg": 11,
}


def compute_dv_percent(totals: dict[str, float | Decimal | None]) -> dict[str, float]:
    """Return % of Health Canada DV per nutrient. Missing/None values yield 0.

    `saturated_trans_g` (combined) is auto-derived from `saturated_fat_g` +
    `trans_fat_g` when the combined value isn't supplied directly — labels
    quote DV against the sum, not the individual lines.
    """
    out: dict[str, float] = {}
    sat = totals.get("saturated_fat_g")
    trans = totals.get("trans_fat_g")
    combined = totals.get("saturated_trans_g")
    if combined is None and (sat is not None or trans is not None):
        combined = float(sat or 0) + float(trans or 0)
    merged: dict[str, float | Decimal | None] = dict(totals)
    if combined is not None:
        merged["saturated_trans_g"] = combined

    for key, dv in CANADIAN_DV.items():
        raw = merged.get(key)
        if raw is None or dv <= 0:
            out[key] = 0.0
            continue
        out[key] = round(float(raw) / float(dv) * 100, 1)
    return out
