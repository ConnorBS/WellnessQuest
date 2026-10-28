import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  THEME_PRESETS,
  cardTintStyle,
  contrastText,
  isHex,
  mix,
  resolveTheme,
  shade,
} from "./theme";

describe("colour helpers", () => {
  it("validates #rrggbb only", () => {
    expect(isHex("#10b981")).toBe(true);
    expect(isHex("#10B981")).toBe(true);
    expect(isHex("#fff")).toBe(false);
    expect(isHex("red")).toBe(false);
    expect(isHex("#10b981; x")).toBe(false);
    expect(isHex(null)).toBe(false);
  });

  it("picks readable text on the accent", () => {
    expect(contrastText("#10b981")).toBe("#0b1220");
    expect(contrastText("#1d4ed8")).toBe("#ffffff");
    expect(contrastText("#fbbf24")).toBe("#0b1220");
    expect(contrastText("#ffffff")).toBe("#0b1220");
    expect(contrastText("#000000")).toBe("#ffffff");
  });

  it("mixes and shades", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(shade("#000000", 1)).toBe("#ffffff");
    expect(shade("#ffffff", -1)).toBe("#000000");
    expect(mix("#102030", "#102030", 0.3)).toBe("#102030");
  });
});

describe("resolveTheme", () => {
  it("is empty when nothing is overridden", () => {
    expect(resolveTheme({})).toEqual({});
    expect(resolveTheme({ background: null, accent: undefined })).toEqual({});
    expect(resolveTheme({ background: "nope" })).toEqual({});
  });

  it("sets only the slots the user touched plus their derivatives", () => {
    const vars = resolveTheme({ accent: "#FB923C" });
    expect(vars["--wq-accent"]).toBe("#fb923c");
    expect(vars["--wq-on-accent"]).toBe("#0b1220");
    expect(vars["--wq-bg"]).toBeUndefined();
    expect(vars["--wq-text"]).toBeUndefined();
  });

  it("derives readable text and borders from a light background", () => {
    const vars = resolveTheme({ background: "#f8fafc" });
    expect(vars["--wq-bg"]).toBe("#f8fafc");
    expect(vars["--wq-text"]).toBe("#0f172a");
    expect(vars["--wq-muted"]).toBe("#475569");
    expect(vars["--wq-border"]).toBe("#cbd5e1");
    expect(isHex(vars["--wq-card"])).toBe(true);
    expect(isHex(vars["--wq-surface"])).toBe(true);
  });

  it("keeps the dark text on a dark background", () => {
    const vars = resolveTheme({ background: "#0b1a12" });
    expect(vars["--wq-text"]).toBe("#e2e8f0");
    expect(vars["--wq-muted"]).toBe("#94a3b8");
  });

  it("explicit slots win over derived ones", () => {
    const vars = resolveTheme({ background: "#ffffff", text: "#123456", card: "#eeeeee" });
    expect(vars["--wq-text"]).toBe("#123456");
    expect(vars["--wq-card"]).toBe("#eeeeee");
  });
});

describe("presets", () => {
  it("only contain valid colours and the default preset is empty", () => {
    expect(THEME_PRESETS[0]?.theme).toEqual({});
    for (const p of THEME_PRESETS) {
      for (const v of Object.values(p.theme)) expect(isHex(v)).toBe(true);
    }
    for (const v of Object.values(DEFAULT_THEME)) expect(isHex(v)).toBe(true);
  });
});

describe("cardTintStyle", () => {
  it("returns nothing for an unset tint and card vars for a set one", () => {
    expect(cardTintStyle(null)).toBeUndefined();
    expect(cardTintStyle("bad")).toBeUndefined();
    const style = cardTintStyle("#0b3d5c") as Record<string, string>;
    expect(style["--wq-card"]).toBe("#0b3d5c");
    expect(isHex(style["--wq-surface"])).toBe(true);
    expect(style["--wq-bg"]).toBeUndefined();
    // Dark tint on the dark default: text is inherited, not overridden.
    expect(style["--wq-text"]).toBeUndefined();
  });

  it("flips text and borders when the tint clashes with the page text", () => {
    const onDark = cardTintStyle("#dbeafe") as Record<string, string>;
    expect(onDark["--wq-text"]).toBe("#0f172a");
    expect(onDark.color).toBe("#0f172a");
    expect(onDark["--wq-muted"]).toBe("#475569");
    expect(isHex(onDark["--wq-border"])).toBe(true);

    const onLight = cardTintStyle("#0b3d5c", { background: "#f8fafc" }) as Record<string, string>;
    expect(onLight["--wq-text"]).toBe("#e2e8f0");

    const lightOnLight = cardTintStyle("#dbeafe", { background: "#f8fafc" }) as Record<string, string>;
    expect(lightOnLight["--wq-text"]).toBeUndefined();
    expect(lightOnLight.color).toBeUndefined();
  });
});
