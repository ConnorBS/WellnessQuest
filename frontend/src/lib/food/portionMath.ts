// Per-portion nutrient resolver shared by the food-log modal and the
// recipe-ingredient picker. Extracted from FoodLogModal.computed so the
// recipe builder gets identical math without re-deriving it.
//
// The contract: given a per-100 nutrient panel (OFF search hit OR a
// preset's per-serving panel collapsed back to per-100) and a portion
// spec (quantity × unit), return the pre-multiplied values that the
// backend wants stored on the food entry / recipe ingredient.
//
// Whichever unit basis the source publishes — g or mL — drives the
// kcal/macro lane choice; the extended nutrient panel is only published
// per-100g by OFF, so it's always scaled by the same factor regardless
// of the chosen native unit. (No water-density fallback here — that's
// a separate decision, tracked in the plan as a deferred risk.)

import type { FoodUnit } from "@/lib/schemas";

// Default to solid (g/oz). Most packaged foods are mass-labelled and
// OFF leaves `unit` null when it can't tell — matches FoodLogModal's
// historical default.
const DEFAULT_NATIVE_UNIT: FoodUnit = "g";

export type IngredientUnit = "g" | "ml" | "serving";

export interface PerHundredSource {
  unit?: FoodUnit | null;
  kcal_per_100g?: number | null;
  protein_per_100g?: number | null;
  carbs_per_100g?: number | null;
  fat_per_100g?: number | null;
  kcal_per_100ml?: number | null;
  protein_per_100ml?: number | null;
  carbs_per_100ml?: number | null;
  fat_per_100ml?: number | null;
  nutrients_per_100g?: Record<string, number> | null;
}

export interface PortionSpec {
  quantity: number;
  unit: IngredientUnit;
  // Mass of one serving when `unit === "serving"`. Ignored otherwise.
  servingG?: number | null;
}

export interface PortionResult {
  hasNutritionData: boolean;
  nativeAmount: number;
  nativeUnit: FoodUnit;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  nutrients: Record<string, number>;
}

export function resolveNativeUnit(source: PerHundredSource): FoodUnit {
  return source.unit ?? DEFAULT_NATIVE_UNIT;
}

export function resolveNativeAmount(spec: PortionSpec): number {
  if (spec.unit === "serving") {
    const sg = spec.servingG ?? 0;
    return spec.quantity * sg;
  }
  return spec.quantity;
}

export function resolvePortion(
  source: PerHundredSource,
  spec: PortionSpec,
): PortionResult {
  const native: FoodUnit =
    spec.unit === "ml" ? "ml" : spec.unit === "g" ? "g" : resolveNativeUnit(source);
  let nativeAmount = resolveNativeAmount(spec);
  if (!Number.isFinite(nativeAmount) || nativeAmount < 0) nativeAmount = 0;
  const factor = nativeAmount / 100;

  const kcalPer100 =
    native === "ml"
      ? (source.kcal_per_100ml ?? source.kcal_per_100g)
      : (source.kcal_per_100g ?? source.kcal_per_100ml);
  const pPer100 =
    native === "ml"
      ? (source.protein_per_100ml ?? source.protein_per_100g)
      : (source.protein_per_100g ?? source.protein_per_100ml);
  const cPer100 =
    native === "ml"
      ? (source.carbs_per_100ml ?? source.carbs_per_100g)
      : (source.carbs_per_100g ?? source.carbs_per_100ml);
  const fPer100 =
    native === "ml"
      ? (source.fat_per_100ml ?? source.fat_per_100g)
      : (source.fat_per_100g ?? source.fat_per_100ml);

  const scale1dp = (v: number | null | undefined): number | null =>
    v == null ? null : Math.round(v * factor * 10) / 10;

  const nutPer100 = source.nutrients_per_100g ?? {};
  const nutrients: Record<string, number> = {};
  for (const [key, v] of Object.entries(nutPer100)) {
    nutrients[key] = Math.round(v * factor * 1000) / 1000;
  }

  return {
    hasNutritionData: kcalPer100 != null,
    nativeAmount,
    nativeUnit: native,
    kcal: kcalPer100 != null ? Math.round(kcalPer100 * factor) : null,
    protein_g: scale1dp(pPer100),
    carbs_g: scale1dp(cPer100),
    fat_g: scale1dp(fPer100),
    nutrients,
  };
}
