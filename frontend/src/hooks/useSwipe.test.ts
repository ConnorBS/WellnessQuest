import { describe, expect, it } from "vitest";

import { resolveSwipe } from "./useSwipe";

const base = { armed: true, zoomed: false, dx: 0, dy: 0, threshold: 60 };

describe("resolveSwipe", () => {
  it("fires right on a single-finger rightward drag past threshold", () => {
    expect(resolveSwipe({ ...base, dx: 80, dy: 5 })).toBe("right");
  });

  it("fires left on a single-finger leftward drag past threshold", () => {
    expect(resolveSwipe({ ...base, dx: -80, dy: 5 })).toBe("left");
  });

  it("ignores a gesture that wasn't a clean single finger (pinch disarms it)", () => {
    expect(resolveSwipe({ ...base, armed: false, dx: 120, dy: 5 })).toBeNull();
  });

  it("ignores swipes while the page is pinch-zoomed in", () => {
    expect(resolveSwipe({ ...base, zoomed: true, dx: 120, dy: 5 })).toBeNull();
  });

  it("ignores a drag that doesn't clear the horizontal threshold", () => {
    expect(resolveSwipe({ ...base, dx: 40, dy: 2 })).toBeNull();
  });

  it("ignores a vertical-dominant drag so scrolling doesn't navigate", () => {
    expect(resolveSwipe({ ...base, dx: 70, dy: 60 })).toBeNull();
  });
});
