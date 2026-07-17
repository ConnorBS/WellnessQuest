import { describe, expect, it } from "vitest";

import { computeCycleStats, dayKey } from "./cycle";
import type { PeriodEntry } from "./schemas";

function day(date: string, flow: PeriodEntry["flow"] = "medium"): PeriodEntry {
  return { id: 0, entry_date: date, flow, symptoms: [], note: null };
}

// Two full periods 28 days apart, each 5 days long.
const twoCycles: PeriodEntry[] = [
  day("2026-01-01"),
  day("2026-01-02"),
  day("2026-01-03"),
  day("2026-01-04"),
  day("2026-01-05"),
  day("2026-01-29"),
  day("2026-01-30"),
  day("2026-01-31"),
  day("2026-02-01"),
  day("2026-02-02"),
];

describe("computeCycleStats", () => {
  it("detects period starts and averages", () => {
    const s = computeCycleStats(twoCycles);
    expect(s.periodStarts.map(dayKey)).toEqual(["2026-01-01", "2026-01-29"]);
    expect(s.avgCycleLength).toBe(28);
    expect(s.avgPeriodLength).toBe(5);
  });

  it("predicts next period and fertile window from the last start", () => {
    const s = computeCycleStats(twoCycles);
    expect(dayKey(s.lastStart!)).toBe("2026-01-29");
    expect(dayKey(s.predictedNextStart!)).toBe("2026-02-26");
    // Ovulation ~14 days before predicted next start; fertile = ovu-5 .. ovu+1.
    expect(dayKey(s.ovulation!)).toBe("2026-02-12");
    expect(dayKey(s.fertileStart!)).toBe("2026-02-07");
    expect(dayKey(s.fertileEnd!)).toBe("2026-02-13");
  });

  it("returns nulls when there is not enough history", () => {
    const s = computeCycleStats([day("2026-03-10"), day("2026-03-11")]);
    expect(s.avgCycleLength).toBeNull();
    expect(s.predictedNextStart).toBeNull();
    expect(s.periodStarts).toHaveLength(1);
  });

  it("ignores implausible cycle gaps", () => {
    // A 3-day gap is not a real cycle; should not produce an average.
    const s = computeCycleStats([day("2026-01-01"), day("2026-01-04")]);
    expect(s.avgCycleLength).toBeNull();
  });
});
