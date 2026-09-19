import { describe, expect, it } from "vitest";

import { describeEntry, topTriggers } from "./reflux";
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
  it("ranks triggers by how many episodes named them", () => {
    const out = topTriggers(
      [
        entry({ id: 1, triggers: ["spicy", "caffeine"] }),
        entry({ id: 2, triggers: ["spicy"] }),
        entry({ id: 3, triggers: ["late_meal"] }),
        entry({ id: 4 }),
      ],
      30,
      now,
    );
    expect(out.map((t) => t.trigger)).toEqual(["spicy", "caffeine", "late_meal"]);
    expect(out[0]).toEqual({ trigger: "spicy", count: 2, share: 0.5 });
  });

  it("breaks ties alphabetically so the order is stable", () => {
    const out = topTriggers([entry({ triggers: ["tomato", "alcohol"] })], 30, now);
    expect(out.map((t) => t.trigger)).toEqual(["alcohol", "tomato"]);
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
