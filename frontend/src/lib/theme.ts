/**
 * Appearance preferences: the palette slots a user can override, the CSS
 * custom properties they map to, and the colour math that derives the
 * secondary tones (input surfaces, dividers, text on the accent) so a single
 * "background" or "accent" pick still produces a coherent page.
 *
 * Every surface in the app reads `var(--wq-*)` — see `styles/globals.css` for
 * the defaults. `applyTheme` only writes a property when the user set the slot
 * it derives from, so with no overrides the page is pixel-identical to the
 * built-in dark theme.
 */

import type { CSSProperties } from "react";

export type ThemeSlot = "background" | "card" | "border" | "accent" | "text" | "muted";

export type UiTheme = Partial<Record<ThemeSlot, string | null>>;

export type UiSection = "xp_bar" | "streaks" | "quick_log" | "version_footer";

export interface UiPrefs {
  theme: UiTheme;
  card_colors: Record<string, string>;
  hidden_sections: UiSection[];
}

export const EMPTY_PREFS: UiPrefs = { theme: {}, card_colors: {}, hidden_sections: [] };

export const THEME_SLOTS: { key: ThemeSlot; label: string; hint: string }[] = [
  { key: "background", label: "Page background", hint: "Behind everything" },
  { key: "card", label: "Cards", hint: "Each tracker's panel" },
  { key: "border", label: "Borders", hint: "Card outlines and dividers" },
  { key: "accent", label: "Accent", hint: "Buttons, progress bars, active links" },
  { key: "text", label: "Text", hint: "Headings and values" },
  { key: "muted", label: "Muted text", hint: "Hints and secondary labels" },
];

export const SECTIONS: { key: UiSection; label: string; hint: string }[] = [
  { key: "xp_bar", label: "Level & XP bar", hint: "The level / XP strip at the top of the dashboard" },
  { key: "streaks", label: "Streak badges", hint: "The goal-met chips under the cards" },
  {
    key: "quick_log",
    label: "“+ Log” buttons",
    hint: "The shortcut on each dashboard card that opens its logging form",
  },
  { key: "version_footer", label: "Version footer", hint: "The build number at the bottom of every page" },
];

/** Built-in dark palette. Must match the `:root` defaults in globals.css. */
export const DEFAULT_THEME: Record<ThemeSlot, string> = {
  background: "#020617",
  card: "#0f172a",
  border: "#334155",
  accent: "#10b981",
  text: "#e2e8f0",
  muted: "#94a3b8",
};

export const THEME_PRESETS: { name: string; theme: UiTheme }[] = [
  { name: "Midnight (default)", theme: {} },
  { name: "Slate", theme: { background: "#0f172a", card: "#1e293b", border: "#475569", accent: "#38bdf8" } },
  { name: "Forest", theme: { background: "#0b1a12", card: "#12261b", border: "#1f4d33", accent: "#4ade80" } },
  { name: "Plum", theme: { background: "#1a0f1f", card: "#2a1838", border: "#4a2d63", accent: "#e879f9" } },
  { name: "Ember", theme: { background: "#1a1210", card: "#2a1b16", border: "#4d3028", accent: "#fb923c" } },
  {
    name: "Light",
    theme: {
      background: "#f1f5f9",
      card: "#ffffff",
      border: "#cbd5e1",
      accent: "#059669",
      text: "#0f172a",
      muted: "#475569",
    },
  },
  {
    name: "Paper",
    theme: {
      background: "#f5f0e6",
      card: "#fffdf7",
      border: "#d6cdb8",
      accent: "#b45309",
      text: "#292524",
      muted: "#78716c",
    },
  },
];

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHex(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance, 0 (black) .. 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLight(hex: string): boolean {
  return luminance(hex) > 0.4;
}

/** Near-black or near-white, whichever reads better on `hex`. */
export function contrastText(hex: string): string {
  return luminance(hex) > 0.3 ? "#0b1220" : "#ffffff";
}

/** Blend `a` toward `b` by `t` (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return toHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

/** Lighten (positive) or darken (negative) by a fraction of the way to white/black. */
export function shade(hex: string, amount: number): string {
  return mix(hex, amount >= 0 ? "#ffffff" : "#000000", Math.abs(amount));
}

/**
 * Resolve the user's slot overrides into the full CSS variable map. Only
 * properties that change away from the stylesheet default are returned, so
 * an empty theme yields an empty map.
 */
export function resolveTheme(theme: UiTheme): Record<string, string> {
  const pick = (slot: ThemeSlot): string | null => {
    const v = theme[slot];
    return isHex(v) ? v.toLowerCase() : null;
  };
  const bg = pick("background");
  const bgIsLight = bg ? isLight(bg) : false;
  const vars: Record<string, string> = {};

  if (bg) vars["--wq-bg"] = bg;

  // A light page background with the dark text/border defaults is unreadable,
  // so derive sensible companions from the background unless the user set
  // them explicitly.
  const text = pick("text") ?? (bg ? (bgIsLight ? "#0f172a" : "#e2e8f0") : null);
  const muted = pick("muted") ?? (bg ? (bgIsLight ? "#475569" : "#94a3b8") : null);
  const border = pick("border") ?? (bg ? (bgIsLight ? "#cbd5e1" : mix(bg, "#ffffff", 0.18)) : null);
  const card = pick("card") ?? (bg ? (bgIsLight ? mix(bg, "#ffffff", 0.7) : mix(bg, "#ffffff", 0.04)) : null);
  const accent = pick("accent");

  if (text) {
    vars["--wq-text"] = text;
    vars["--wq-text-2"] = mix(text, bg ?? DEFAULT_THEME.background, 0.14);
  }
  if (muted) {
    vars["--wq-muted"] = muted;
    vars["--wq-muted-2"] = mix(muted, bg ?? DEFAULT_THEME.background, 0.3);
  }
  if (border) {
    vars["--wq-border"] = border;
    vars["--wq-border-strong"] = shade(border, isLight(border) ? -0.12 : 0.12);
  }
  if (card) {
    vars["--wq-card"] = card;
    // Inputs and inset panels sit on the card, one step away from it.
    const cardIsLight = isLight(card);
    vars["--wq-surface"] = shade(card, cardIsLight ? -0.05 : 0.06);
    vars["--wq-surface-2"] = shade(card, cardIsLight ? -0.11 : 0.14);
  }
  if (accent) {
    vars["--wq-accent"] = accent;
    vars["--wq-on-accent"] = contrastText(accent);
  }
  return vars;
}

export const MANAGED_VARS = [
  "--wq-bg",
  "--wq-card",
  "--wq-surface",
  "--wq-surface-2",
  "--wq-border",
  "--wq-border-strong",
  "--wq-accent",
  "--wq-on-accent",
  "--wq-text",
  "--wq-text-2",
  "--wq-muted",
  "--wq-muted-2",
] as const;

const CACHE_KEY = "wq-theme";

/** Write the theme onto `<html>` and remember it for the next cold start. */
export function applyTheme(theme: UiTheme): void {
  if (typeof document === "undefined") return;
  const vars = resolveTheme(theme);
  const style = document.documentElement.style;
  for (const name of MANAGED_VARS) {
    const value = vars[name];
    if (value) style.setProperty(name, value);
    else style.removeProperty(name);
  }
  const bg = vars["--wq-bg"];
  // Native controls (checkboxes, scrollbars, date pickers) follow this.
  style.colorScheme = bg && isLight(bg) ? "light" : "dark";
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = bg ?? "#0b0f14";
  try {
    if (Object.keys(vars).length === 0) localStorage.removeItem(CACHE_KEY);
    else localStorage.setItem(CACHE_KEY, JSON.stringify(theme));
  } catch {
    /* private mode / quota — the theme still applies for this page load */
  }
}

/**
 * Re-apply the last saved theme before `/me` has answered, so a themed user
 * doesn't get a flash of the default palette on every cold start.
 */
export function applyCachedTheme(): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    const theme: UiTheme = {};
    for (const slot of THEME_SLOTS) {
      const v = (parsed as Record<string, unknown>)[slot.key];
      if (isHex(v)) theme[slot.key] = v;
    }
    applyTheme(theme);
  } catch {
    /* ignore a corrupt cache */
  }
}

/**
 * Inline style that tints one card (or a whole tracker page) via the cascade.
 * When the tint's lightness clashes with the page's text (a pale card on the
 * dark theme, or the reverse), the text, muted and border tones are flipped
 * too, so the tinted card stays readable instead of inheriting near-white
 * text onto a near-white background.
 */
export function cardTintStyle(
  color: string | null | undefined,
  theme: UiTheme = {},
): CSSProperties | undefined {
  if (!isHex(color)) return undefined;
  const card = color.toLowerCase();
  const vars = resolveTheme({ card });
  const pageText = resolveTheme(theme)["--wq-text"] ?? DEFAULT_THEME.text;
  const cardIsLight = isLight(card);
  if (cardIsLight === isLight(pageText)) {
    const text = cardIsLight ? "#0f172a" : "#e2e8f0";
    const muted = cardIsLight ? "#475569" : "#94a3b8";
    vars["--wq-text"] = text;
    // Headings inherit `color` as a computed value from <body>, so the
    // variable alone doesn't reach them; set the colour on the wrapper too.
    vars.color = text;
    vars["--wq-text-2"] = mix(text, card, 0.14);
    vars["--wq-muted"] = muted;
    vars["--wq-muted-2"] = mix(muted, card, 0.3);
    vars["--wq-border"] = shade(card, cardIsLight ? -0.18 : 0.18);
    vars["--wq-border-strong"] = shade(card, cardIsLight ? -0.28 : 0.28);
  }
  return vars as CSSProperties;
}
