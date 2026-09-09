import { describe, expect, it } from "vitest";

import { journalPreview } from "./journal";

describe("journalPreview", () => {
  it("takes the first non-empty line", () => {
    expect(journalPreview("\n\n  Saw a heron.  \nThen went home.")).toBe("Saw a heron.");
  });

  it("clips long lines with an ellipsis", () => {
    expect(journalPreview("a".repeat(200), 10)).toBe(`${"a".repeat(9)}…`);
  });

  it("leaves a line at the limit alone", () => {
    expect(journalPreview("a".repeat(10), 10)).toBe("a".repeat(10));
  });

  it("returns an empty string for an empty note", () => {
    expect(journalPreview("   \n  ")).toBe("");
  });
});
