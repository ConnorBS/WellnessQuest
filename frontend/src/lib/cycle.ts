import type { FlowValue, PeriodEntry, PeriodSymptom } from "@/lib/schemas";

export const FLOW_META: Record<FlowValue, { label: string; color: string }> = {
  spotting: { label: "Spotting", color: "#fda4af" },
  light: { label: "Light", color: "#fb7185" },
  medium: { label: "Medium", color: "#e11d48" },
  heavy: { label: "Heavy", color: "#9f1239" },
};

export const FLOW_ORDER: FlowValue[] = ["spotting", "light", "medium", "heavy"];

export const SYMPTOM_LABELS: Record<PeriodSymptom, string> = {
  cramps: "Cramps",
  headache: "Headache",
  mood_swings: "Mood swings",
  bloating: "Bloating",
  fatigue: "Fatigue",
  backache: "Backache",
  nausea: "Nausea",
  tender_breasts: "Tender breasts",
  acne: "Acne",
  cravings: "Cravings",
};

export const SYMPTOM_ORDER: PeriodSymptom[] = [
  "cramps",
  "headache",
  "mood_swings",
  "bloating",
  "fatigue",
  "backache",
  "nausea",
  "tender_breasts",
  "acne",
  "cravings",
];

// --- date helpers (local, date-only) ---------------------------------------

/** Parse an ISO 'YYYY-MM-DD' as a local date at midnight (avoids TZ drift). */
export function parseDay(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export interface CycleStats {
  loggedDays: Set<string>;
  /** First day of each detected period (a logged day whose prior day was not logged). */
  periodStarts: Date[];
  avgCycleLength: number | null;
  avgPeriodLength: number | null;
  lastStart: Date | null;
  predictedNextStart: Date | null;
  ovulation: Date | null;
  fertileStart: Date | null;
  fertileEnd: Date | null;
  isOnPeriodToday: boolean;
  daysUntilNext: number | null;
}

/**
 * Derive cycle statistics from raw period-day history. Predictions are simple
 * averages (not medical advice) — the UI shows a caveat.
 */
export function computeCycleStats(entries: PeriodEntry[]): CycleStats {
  const loggedDays = new Set(entries.map((e) => e.entry_date));
  const sorted = [...entries]
    .map((e) => parseDay(e.entry_date))
    .sort((a, b) => a.getTime() - b.getTime());

  const periodStarts: Date[] = [];
  const runLengths: number[] = [];
  let currentRun = 0;
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const prev = i > 0 ? sorted[i - 1]! : null;
    const isStart = prev == null || diffDays(cur, prev) > 1;
    if (isStart) {
      periodStarts.push(cur);
      if (currentRun > 0) runLengths.push(currentRun);
      currentRun = 1;
    } else {
      currentRun += 1;
    }
  }
  if (currentRun > 0) runLengths.push(currentRun);

  // Cycle lengths = gaps between consecutive starts; use up to the last 6.
  const cycles: number[] = [];
  for (let i = 1; i < periodStarts.length; i++) {
    cycles.push(diffDays(periodStarts[i]!, periodStarts[i - 1]!));
  }
  const recentCycles = cycles.slice(-6).filter((c) => c >= 15 && c <= 60);
  const avgCycleLength =
    recentCycles.length > 0
      ? Math.round(recentCycles.reduce((a, b) => a + b, 0) / recentCycles.length)
      : null;

  const avgPeriodLength =
    runLengths.length > 0
      ? Math.round(runLengths.reduce((a, b) => a + b, 0) / runLengths.length)
      : null;

  const lastStart =
    periodStarts.length > 0 ? periodStarts[periodStarts.length - 1]! : null;

  let predictedNextStart: Date | null = null;
  let ovulation: Date | null = null;
  let fertileStart: Date | null = null;
  let fertileEnd: Date | null = null;
  if (lastStart && avgCycleLength) {
    predictedNextStart = addDays(lastStart, avgCycleLength);
    ovulation = addDays(predictedNextStart, -14);
    fertileStart = addDays(ovulation, -5);
    fertileEnd = addDays(ovulation, 1);
  }

  const todayKey = dayKey(new Date());
  const isOnPeriodToday = loggedDays.has(todayKey);
  const daysUntilNext =
    predictedNextStart != null ? diffDays(predictedNextStart, new Date()) : null;

  return {
    loggedDays,
    periodStarts,
    avgCycleLength,
    avgPeriodLength,
    lastStart,
    predictedNextStart,
    ovulation,
    fertileStart,
    fertileEnd,
    isOnPeriodToday,
    daysUntilNext,
  };
}
