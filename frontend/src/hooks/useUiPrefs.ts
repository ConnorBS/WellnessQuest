"use client";

import { useMe } from "@/hooks/useMe";
import { EMPTY_PREFS, type UiPrefs, type UiSection } from "@/lib/theme";

/**
 * Appearance preferences from the already-loaded /me payload (no extra
 * request). Missing prefs (older cached /me) read as "all defaults".
 */
export function useUiPrefs() {
  const { data: me } = useMe();
  const prefs: UiPrefs = me?.ui_prefs ?? EMPTY_PREFS;
  const hidden = new Set<string>(prefs.hidden_sections);
  return {
    prefs,
    isHidden: (section: UiSection) => hidden.has(section),
    cardColor: (featureKey: string): string | null => prefs.card_colors[featureKey] ?? null,
  };
}
