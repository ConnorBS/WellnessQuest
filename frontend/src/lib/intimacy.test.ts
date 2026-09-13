import { describe, expect, it } from "vitest";

import { computeCycleStats } from "./cycle";
import {
  describeEntry,
  fertileWindowKeys,
  isFertileWindowRisk,
  loggedDayKeys,
} from "./intimacy";
import type { IntimacyEntry, PeriodEntry } from "./schemas";

function periodDay(date: string): PeriodEntry {
  return { id: 0, entry_date: date, flow: "medium", symptoms: [], note: null };
}

function entry(over: Partial<IntimacyEntry> = {}): IntimacyEntry {
  return {
    id: 1,
    entry_date: "2026-02-14",
    kind: "partnered",
    protection: "unspecified",
    tags: [],
    note: null,
    created_at: "2026-02-14T10:00:00Z",
    updated_at: "2026-02-14T10:00:00Z",
    ...over,
  };
}

// Two 5-day periods 28 days apart: next start predicted 2026-02-26, ovulation
// 14 days before that (2026-02-12), fertile window 2026-02-07 .. 2026-02-13.
const twoCycles: PeriodEntry[] = [
  "2026-01-01",
  "2026-01-02",
  "2026-01-03",
  "2026-01-04",
  "2026-01-05",
  "2026-01-29",
  "2026-01-30",
  "2026-01-31",
  "2026-02-01",
  "2026-02-02",
].map(periodDay);

const stats = computeCycleStats(twoCycles);

describe("fertileWindowKeys", () => {
  it("covers the estimated window inclusively", () => {
    const keys = fertileWindowKeys(stats);
    expect(keys.has("2026-02-07")).toBe(true);
    expect(keys.has("2026-02-13")).toBe(true);
    expect(keys.has("2026-02-06")).toBe(false);
    expect(keys.has("2026-02-14")).toBe(false);
  });

  it("is empty without enough history to predict", () => {
    expect(fertileWindowKeys(computeCycleStats([periodDay("2026-01-01")])).size).toBe(0);
  });
});

describe("isFertileWindowRisk", () => {
  it("flags unprotected partnered activity inside the window", () => {
    const e = entry({ entry_date: "2026-02-10", protection: "unprotected" });
    expect(isFertileWindowRisk(e, stats)).toBe(true);
  });

  it("treats withdrawal as unprotected", () => {
    const e = entry({ entry_date: "2026-02-10", protection: "withdrawal" });
    expect(isFertileWindowRisk(e, stats)).toBe(true);
  });

  it("does not flag protected activity", () => {
    const e = entry({ entry_date: "2026-02-10", protection: "protected" });
    expect(isFertileWindowRisk(e, stats)).toBe(false);
  });

  it("does not guess when protection was not recorded", () => {
    const e = entry({ entry_date: "2026-02-10", protection: "unspecified" });
    expect(isFertileWindowRisk(e, stats)).toBe(false);
  });

  it("does not flag solo entries", () => {
    const e = entry({
      entry_date: "2026-02-10",
      kind: "solo",
      protection: "unprotected",
    });
    expect(isFertileWindowRisk(e, stats)).toBe(false);
  });

  it("does not flag entries outside the window", () => {
    const e = entry({ entry_date: "2026-02-20", protection: "unprotected" });
    expect(isFertileWindowRisk(e, stats)).toBe(false);
  });
});

describe("describeEntry", () => {
  it("names the kind and the protection for partnered entries", () => {
    expect(describeEntry(entry({ protection: "protected" }))).toBe(
      "With a partner · Protected",
    );
  });

  it("omits protection when it was not recorded", () => {
    expect(describeEntry(entry())).toBe("With a partner");
  });

  it("omits protection entirely for solo entries", () => {
    expect(describeEntry(entry({ kind: "solo", protection: "protected" }))).toBe(
      "Solo",
    );
  });
});

describe("loggedDayKeys", () => {
  it("collapses several entries on one day to a single key", () => {
    const keys = loggedDayKeys([
      entry({ id: 1, entry_date: "2026-02-14" }),
      entry({ id: 2, entry_date: "2026-02-14" }),
      entry({ id: 3, entry_date: "2026-02-15" }),
    ]);
    expect([...keys].sort()).toEqual(["2026-02-14", "2026-02-15"]);
  });
});
