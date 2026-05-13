import type { FoodUnit } from "@/lib/schemas";

// Weight unit conversion helpers. Storage is always kg; display can be lb.
const KG_PER_LB = 0.45359237;

export function kgToDisplay(kg: number, unit: string): number {
  if (unit === "lb") return kg / KG_PER_LB;
  return kg;
}

export function displayToKg(display: number, unit: string): number {
  if (unit === "lb") return display * KG_PER_LB;
  return display;
}

export function formatWeight(kg: number | null | undefined, unit: string, digits = 1): string {
  if (kg == null) return "—";
  const v = kgToDisplay(kg, unit);
  return `${v.toFixed(digits)} ${unit}`;
}

export function formatWeightDelta(deltaKg: number | null | undefined, unit: string): string {
  if (deltaKg == null) return "";
  const v = kgToDisplay(Math.abs(deltaKg), unit);
  if (deltaKg === 0) return `flat`;
  const direction = deltaKg > 0 ? "up" : "down";
  return `${direction} ${v.toFixed(1)} ${unit}`;
}

// ---------- Food portion units ----------

export type SolidUnit = "g" | "oz";
export type LiquidUnit = "ml" | "fl_oz" | "cup" | "tbsp" | "tsp";
export type PortionUnit = SolidUnit | LiquidUnit;

export const PORTION_UNIT_LABELS: Record<PortionUnit, string> = {
  g: "g",
  oz: "oz",
  ml: "mL",
  fl_oz: "fl oz",
  cup: "cup",
  tbsp: "tbsp",
  tsp: "tsp",
};

const SOLID_UNITS: PortionUnit[] = ["g", "oz"];
const LIQUID_UNITS: PortionUnit[] = ["ml", "fl_oz", "cup", "tbsp", "tsp"];

export function portionUnitsFor(nativeUnit: FoodUnit | null | undefined): PortionUnit[] {
  // When OFF didn't tell us the unit, assume solid (g) — that's how most
  // packaged foods are labelled and it's the safer default to display.
  return nativeUnit === "ml" ? LIQUID_UNITS : SOLID_UNITS;
}

// 1 unit of `from` equals this many native units (g for solids, mL for liquids).
const TO_NATIVE_FACTOR: Record<PortionUnit, number> = {
  g: 1,
  oz: 28.3495,
  ml: 1,
  fl_oz: 29.5735, // US fluid ounce
  cup: 240, // FDA labelling cup, also widely used elsewhere
  tbsp: 14.7868,
  tsp: 4.92892,
};

function isLiquidUnit(u: PortionUnit): boolean {
  return u === "ml" || u === "fl_oz" || u === "cup" || u === "tbsp" || u === "tsp";
}

/**
 * Convert an amount from a chosen portion unit to the product's native unit
 * (g or mL). Returns null when the conversion is impossible without a density
 * assumption — e.g. picking "cup" for a solid product. Callers can fall back
 * to a sensible default or refuse to compute.
 */
export function toNative(
  amount: number,
  from: PortionUnit,
  native: FoodUnit,
): number | null {
  if (isLiquidUnit(from) !== (native === "ml")) return null;
  return amount * TO_NATIVE_FACTOR[from];
}
