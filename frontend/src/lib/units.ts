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
