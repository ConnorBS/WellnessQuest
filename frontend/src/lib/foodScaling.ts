import type { NutrientPanel } from "@/lib/schemas";

/**
 * Inputs to the rescale flow: a snapshot of the kcal / macros / nutrient
 * panel that describe ONE serving, plus the serving size that snapshot
 * applies to.
 */
export type ScaleableValues = {
  kcal: number | "";
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  nutrients: NutrientPanel;
};

/**
 * Multiply every numeric field on a quick-food form by `ratio`. Used by the
 * "Rescale…" action on PresetForm / ParsedLabelReview / FoodLogModal so the
 * user can redefine what "1 serving" means and have all 20-something rows
 * recomputed in one shot, instead of typing each cell again.
 *
 * Empty strings stay empty (so blank inputs don't quietly turn into 0). Null
 * nutrient values stay null. kcal rounds to int; macros + nutrients round to
 * 2 decimals — same precision the OCR/OFF flows write.
 */
export function scaleValues(values: ScaleableValues, ratio: number): ScaleableValues {
  if (!Number.isFinite(ratio) || ratio <= 0) return values;
  const kcal: number | "" = values.kcal === "" ? "" : Math.round(Number(values.kcal) * ratio);
  const nutrients: NutrientPanel = {};
  for (const [k, v] of Object.entries(values.nutrients)) {
    if (v == null) continue;
    (nutrients as Record<string, number>)[k] = round2(v * ratio);
  }
  return {
    kcal,
    protein_g: scaleString(values.protein_g, ratio),
    carbs_g: scaleString(values.carbs_g, ratio),
    fat_g: scaleString(values.fat_g, ratio),
    nutrients,
  };
}

/**
 * Variant used by FoodLogModal when scaling numeric kcal/macros and a
 * `Record<string, number>` nutrient blob (the OFF + manual save-as-preset
 * flow). Returns rounded numbers — empty inputs aren't a concept here.
 */
export function scaleNumeric(
  values: {
    kcal: number;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    nutrients: Record<string, number> | null;
  },
  ratio: number,
): typeof values {
  if (!Number.isFinite(ratio) || ratio <= 0) return values;
  const nutrients: Record<string, number> | null = values.nutrients
    ? Object.fromEntries(
        Object.entries(values.nutrients).map(([k, v]) => [k, round2(v * ratio)]),
      )
    : null;
  return {
    kcal: Math.round(values.kcal * ratio),
    protein_g: values.protein_g == null ? null : round2(values.protein_g * ratio),
    carbs_g: values.carbs_g == null ? null : round2(values.carbs_g * ratio),
    fat_g: values.fat_g == null ? null : round2(values.fat_g * ratio),
    nutrients,
  };
}

function scaleString(raw: string, ratio: number): string {
  if (raw.trim() === "") return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return String(round2(n * ratio));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
