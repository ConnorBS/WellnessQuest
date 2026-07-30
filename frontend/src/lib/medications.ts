import type { MedicationChange } from "@/lib/schemas";

interface DoseLike {
  dose_amount: number | null;
  dose_unit: string | null;
  frequency: string | null;
}

/** Trim the trailing zeros Numeric(10,3) gives us: 50.000 → "50", 2.500 → "2.5". */
export function formatAmount(amount: number): string {
  return String(Number(amount.toFixed(3)));
}

export function doseText(d: DoseLike): string | null {
  const dose =
    d.dose_amount === null
      ? null
      : [formatAmount(d.dose_amount), d.dose_unit ?? ""].join(" ").trim();
  return [dose, d.frequency].filter(Boolean).join(" · ") || null;
}

export const CHANGE_LABELS: Record<string, string> = {
  started: "Started",
  dose_change: "Dose change",
  schedule_change: "Schedule change",
  paused: "Paused",
  resumed: "Resumed",
  stopped: "Stopped",
  note: "Note",
};

export function changeLabel(kind: string): string {
  return CHANGE_LABELS[kind] ?? kind;
}

/** One-line description of what a timeline row actually recorded. */
export function changeSummary(c: MedicationChange): string {
  const dose = doseText(c);
  if (c.kind === "started") return dose ? `Started on ${dose}` : "Started";
  if (c.kind === "stopped") return "Stopped";
  if (c.kind === "resumed") return dose ? `Resumed on ${dose}` : "Resumed";
  if (c.kind === "paused") return "Paused";
  if (dose) return `Changed to ${dose}`;
  return changeLabel(c.kind);
}

/** `YYYY-MM-DD` → a readable local date. Parsed as local, not UTC, so the
 *  day doesn't slide backwards west of Greenwich. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Whole days between two `YYYY-MM-DD` strings, inclusive of the start day. */
export function daysBetween(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = toIso.split("-").map(Number) as [number, number, number];
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000);
}

export function durationText(startedOn: string, endedOn: string | null, today: string): string {
  const days = daysBetween(startedOn, endedOn ?? today);
  if (days < 0) return "";
  if (days < 31) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(days / 365.25);
  return `${years} year${years === 1 ? "" : "s"}`;
}
