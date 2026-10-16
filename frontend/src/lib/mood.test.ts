import { describe, expect, it } from "vitest";

import { MOOD_GROUPS, MOOD_META, moodsLabel } from "./mood";
import { MoodValueSchema } from "./schemas";

describe("moodsLabel", () => {
  it("joins feelings strongest-first", () => {
    expect(moodsLabel([])).toBe("");
    expect(moodsLabel(["happy"])).toBe("Happy");
    expect(moodsLabel(["anxious", "grateful"])).toBe("Anxious & grateful");
    expect(moodsLabel(["anxious", "grateful", "low_energy"])).toBe(
      "Anxious, grateful & low energy",
    );
  });
});

describe("mood vocabulary", () => {
  it("puts every mood in exactly one picker group", () => {
    const grouped = MOOD_GROUPS.flatMap((g) => g.moods);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...MoodValueSchema.options].sort());
    expect(Object.keys(MOOD_META).sort()).toEqual([...MoodValueSchema.options].sort());
  });
});
