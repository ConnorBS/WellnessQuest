import { describe, expect, it } from "vitest";

import {
  compareIso,
  formatViewedDate,
  formatViewedDay,
  msUntilNextLocalMidnight,
} from "./day-context";

describe("formatViewedDay", () => {
  it("labels the current day Today", () => {
    expect(formatViewedDay("2026-07-30", "2026-07-30")).toBe("Today");
  });

  it("labels the day before Yesterday", () => {
    expect(formatViewedDay("2026-07-29", "2026-07-30")).toBe("Yesterday");
  });

  it("relabels the same day once midnight passes", () => {
    // The user stays parked on 2026-07-30 while the clock rolls into the 31st.
    expect(formatViewedDay("2026-07-30", "2026-07-30")).toBe("Today");
    expect(formatViewedDay("2026-07-30", "2026-07-31")).toBe("Yesterday");
    expect(formatViewedDay("2026-07-30", "2026-08-01")).not.toBe("Yesterday");
  });

  it("crosses a month boundary", () => {
    expect(formatViewedDay("2026-07-31", "2026-08-01")).toBe("Yesterday");
  });

  it("falls back to the weekday for older days", () => {
    // 2026-07-24 is a Friday.
    expect(formatViewedDay("2026-07-24", "2026-07-30")).toMatch(/day$/);
  });
});

describe("formatViewedDate", () => {
  it("shows the calendar date under the label", () => {
    expect(formatViewedDate("2026-07-30", "2026-07-30")).toContain("30");
  });

  it("adds the year only when it differs from today's", () => {
    expect(formatViewedDate("2026-07-30", "2026-07-30")).not.toContain("2026");
    expect(formatViewedDate("2025-12-31", "2026-07-30")).toContain("2025");
  });
});

describe("msUntilNextLocalMidnight", () => {
  it("counts down to the next local midnight", () => {
    const at = new Date(2026, 6, 30, 23, 30, 0, 0);
    expect(msUntilNextLocalMidnight(at)).toBe(30 * 60 * 1000);
  });

  it("is a full day just after midnight", () => {
    const at = new Date(2026, 6, 30, 0, 0, 0, 0);
    expect(msUntilNextLocalMidnight(at)).toBe(24 * 60 * 60 * 1000);
  });
});

describe("compareIso", () => {
  it("orders ISO days lexically", () => {
    expect(compareIso("2026-07-29", "2026-07-30")).toBe(-1);
    expect(compareIso("2026-07-30", "2026-07-30")).toBe(0);
    expect(compareIso("2026-07-31", "2026-07-30")).toBe(1);
  });
});
