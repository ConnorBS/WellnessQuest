import { describe, expect, it } from "vitest";

import { describeEntry, severityForWeight, topTriggers } from "./reflux";
import type { RefluxEntry } from "./schemas";

function entry(over: Partial<RefluxEntry> = {}): RefluxEntry {
  return {
    id: 1,
    severity: "mild",
    occurred_at: "2026-09-18T20:00:00Z",
    triggers: [],
    note: null,
    ...over,
  };
}

const now = new Date("2026-09-19T12:00:00Z");

describe("topTriggers", () => {
  it("ranks by frequency weighted by severity, not by ticks alone", () => {
    // Alcohol: one severe episode (3). Spicy: two mild (1+1). Chocolate: one
    // moderate (2). A plain tick count would put spicy first; weighted, alcohol
    // leads, and spicy only edges chocolate on the count tie-break.
    const out = topTriggers(
      [
        entry({ id: 1, severity: "severe", triggers: ["alcohol"] }),
        entry({ id: 2, severity: "moderate", triggers: ["chocolate"] }),
        entry({ id: 3, severity: "mild", triggers: ["spicy"] }),
        entry({ id: 4, severity: "mild", triggers: ["spicy"] }),
      ],
      30,
      now,
    );
    expect(out.map((t) => t.trigger)).toEqual(["alcohol", "spicy", "chocolate"]);
    expect(out[0]).toEqual({
      trigger: "alcohol",
      count: 1,
      score: 3,
      avgSeverity: 3,
      typicalSeverity: "severe",
      share: 1,
    });
    expect(out[1]).toMatchObject({ count: 2, score: 2, avgSeverity: 1, typicalSeverity: "mild" });
    expect(out[1]?.share).toBeCloseTo(2 / 3);
    expect(out[2]).toMatchObject({ count: 1, score: 2, avgSeverity: 2, typicalSeverity: "moderate" });
  });

  it("averages severity across the episodes that named a trigger", () => {
    const out = topTriggers(
      [
        entry({ id: 1, severity: "severe", triggers: ["tomato"] }),
        entry({ id: 2, severity: "mild", triggers: ["tomato"] }),
      ],
      30,
      now,
    );
    expect(out[0]).toMatchObject({ count: 2, score: 4, avgSeverity: 2, typicalSeverity: "moderate" });
  });

  it("breaks score ties by count, then alphabetically", () => {
    const out = topTriggers(
      [
        entry({ id: 1, severity: "moderate", triggers: ["tomato"] }),
        entry({ id: 2, severity: "mild", triggers: ["alcohol"] }),
        entry({ id: 3, severity: "mild", triggers: ["alcohol"] }),
        entry({ id: 4, severity: "moderate", triggers: ["citrus"] }),
      ],
      30,
      now,
    );
    // alcohol and tomato and citrus all score 2; alcohol has two ticks, then
    // the remaining two sort by name.
    expect(out.map((t) => t.trigger)).toEqual(["alcohol", "citrus", "tomato"]);
  });

  it("ignores episodes outside the window", () => {
    const out = topTriggers(
      [
        entry({ id: 1, occurred_at: "2026-07-01T00:00:00Z", triggers: ["mint"] }),
        entry({ id: 2, triggers: ["dairy"] }),
      ],
      30,
      now,
    );
    expect(out.map((t) => t.trigger)).toEqual(["dairy"]);
    expect(out[0]?.share).toBe(1);
  });

  it("is empty with nothing in the window", () => {
    expect(topTriggers([], 30, now)).toEqual([]);
  });
});

describe("severityForWeight", () => {
  it("buckets a mean weight to the nearest severity", () => {
    expect(severityForWeight(1)).toBe("mild");
    expect(severityForWeight(1.49)).toBe("mild");
    expect(severityForWeight(1.5)).toBe("moderate");
    expect(severityForWeight(2.49)).toBe("moderate");
    expect(severityForWeight(2.5)).toBe("severe");
    expect(severityForWeight(3)).toBe("severe");
  });
});

describe("describeEntry", () => {
  it("names the severity alone when nothing was ticked", () => {
    expect(describeEntry(entry({ severity: "severe" }))).toBe("Severe");
  });

  it("appends the trigger labels", () => {
    expect(describeEntry(entry({ triggers: ["spicy", "caffeine"] }))).toBe(
      "Mild · Spicy food, Coffee / caffeine",
    );
  });
});
