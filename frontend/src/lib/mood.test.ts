import { describe, expect, it } from "vitest";

import { moodsLabel } from "./mood";

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
