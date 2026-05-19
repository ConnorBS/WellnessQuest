// Health Canada Daily Values + nutrient classification.
//
// These constants ship as a fallback so the UI can render % bars on the
// first paint, before /food/daily-values returns. The hook in
// `hooks/useDailyValues.ts` overrides them once the server response lands,
// and from then on every component reads through `useDailyValues()` so
// the backend is the source of truth.

import type { DailyValues } from "@/lib/schemas";

export type NutrientKind = "macro" | "encourage" | "limit";

export const FALLBACK_DV: DailyValues = {
  values: {
    kcal: 2000,
    fat_g: 75,
    saturated_trans_g: 20,
    cholesterol_mg: 300,
    sodium_mg: 2300,
    carbs_g: 275,
    fibre_g: 28,
    sugars_g: 100,
    protein_g: 50,
    potassium_mg: 3400,
    calcium_mg: 1300,
    iron_mg: 18,
    vit_a_mcg_rae: 900,
    vit_c_mg: 90,
    vit_d_mcg: 20,
    vit_e_mg: 15,
    vit_k_mcg: 120,
    thiamin_mg: 1.2,
    riboflavin_mg: 1.3,
    niacin_mg: 16,
    vit_b6_mg: 1.7,
    folate_mcg_dfe: 400,
    vit_b12_mcg: 2.4,
    pantothenate_mg: 5,
    phosphorus_mg: 1250,
    magnesium_mg: 420,
    zinc_mg: 11,
  },
  meta: {
    kcal: { label: "Calories", unit: "kcal", kind: "macro" },
    protein_g: { label: "Protein", unit: "g", kind: "macro" },
    carbs_g: { label: "Carbohydrate", unit: "g", kind: "macro" },
    fat_g: { label: "Fat", unit: "g", kind: "limit" },
    saturated_fat_g: { label: "Saturated fat", unit: "g", kind: "limit" },
    trans_fat_g: { label: "Trans fat", unit: "g", kind: "limit" },
    saturated_trans_g: { label: "Saturated + trans", unit: "g", kind: "limit" },
    cholesterol_mg: { label: "Cholesterol", unit: "mg", kind: "limit" },
    sodium_mg: { label: "Sodium", unit: "mg", kind: "limit" },
    sugars_g: { label: "Sugars", unit: "g", kind: "limit" },
    fibre_g: { label: "Fibre", unit: "g", kind: "encourage" },
    potassium_mg: { label: "Potassium", unit: "mg", kind: "encourage" },
    calcium_mg: { label: "Calcium", unit: "mg", kind: "encourage" },
    iron_mg: { label: "Iron", unit: "mg", kind: "encourage" },
    vit_a_mcg_rae: { label: "Vitamin A", unit: "µg RAE", kind: "encourage" },
    vit_c_mg: { label: "Vitamin C", unit: "mg", kind: "encourage" },
    vit_d_mcg: { label: "Vitamin D", unit: "µg", kind: "encourage" },
    vit_e_mg: { label: "Vitamin E", unit: "mg", kind: "encourage" },
    vit_k_mcg: { label: "Vitamin K", unit: "µg", kind: "encourage" },
    thiamin_mg: { label: "Thiamin", unit: "mg", kind: "encourage" },
    riboflavin_mg: { label: "Riboflavin", unit: "mg", kind: "encourage" },
    niacin_mg: { label: "Niacin", unit: "mg", kind: "encourage" },
    vit_b6_mg: { label: "Vitamin B6", unit: "mg", kind: "encourage" },
    folate_mcg_dfe: { label: "Folate", unit: "µg DFE", kind: "encourage" },
    vit_b12_mcg: { label: "Vitamin B12", unit: "µg", kind: "encourage" },
    pantothenate_mg: { label: "Pantothenate", unit: "mg", kind: "encourage" },
    phosphorus_mg: { label: "Phosphorus", unit: "mg", kind: "encourage" },
    magnesium_mg: { label: "Magnesium", unit: "mg", kind: "encourage" },
    zinc_mg: { label: "Zinc", unit: "mg", kind: "encourage" },
  },
};

// Display order for the full nutrient panel — matches the Canadian
// Nutrition Facts panel reading order so the UI feels familiar.
export const PANEL_ORDER: string[] = [
  "kcal",
  "fat_g",
  "saturated_fat_g",
  "trans_fat_g",
  "saturated_trans_g",
  "carbs_g",
  "fibre_g",
  "sugars_g",
  "protein_g",
  "cholesterol_mg",
  "sodium_mg",
  "potassium_mg",
  "calcium_mg",
  "iron_mg",
  "vit_a_mcg_rae",
  "vit_c_mg",
  "vit_d_mcg",
  "vit_e_mg",
  "vit_k_mcg",
  "thiamin_mg",
  "riboflavin_mg",
  "niacin_mg",
  "vit_b6_mg",
  "folate_mcg_dfe",
  "vit_b12_mcg",
  "pantothenate_mg",
  "phosphorus_mg",
  "magnesium_mg",
  "zinc_mg",
];

// Subset displayed on compact widgets (FoodCard dashboard strip).
export const KEY_NUTRIENTS: string[] = [
  "fibre_g",
  "sodium_mg",
  "saturated_trans_g",
  "sugars_g",
];

/**
 * Color hex for a %DV bar based on nutrient classification and amount.
 *
 *   encourage: more = better; <50% muted, 50-99% emerald, ≥100% bright green
 *   limit:     less = better; <50% muted, 50-99% amber, ≥100% red
 *   macro:     informational; always slate
 */
export function dvBarColor(kind: NutrientKind, pct: number): string {
  if (kind === "macro") return "#64748b";
  if (kind === "encourage") {
    if (pct >= 100) return "#22c55e";
    if (pct >= 50) return "#10b981";
    return "#475569";
  }
  // limit
  if (pct >= 115) return "#dc2626";
  if (pct >= 100) return "#f97316";
  if (pct >= 50) return "#fbbf24";
  return "#475569";
}

/**
 * Compute % of a nutrient's DV. Returns 0 when DV isn't defined for the key.
 * Server already computes this for the day-totals, so this is mainly for
 * client-side preview math (e.g. "if I log this, sodium goes to 42%").
 */
export function dvPercent(
  dv: DailyValues,
  key: string,
  amount: number | null | undefined,
): number {
  if (amount == null) return 0;
  const ref = dv.values[key];
  if (!ref || ref <= 0) return 0;
  return Math.round((amount / ref) * 1000) / 10;
}
