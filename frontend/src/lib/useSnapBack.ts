"use client";

import { useEffect, useRef } from "react";

/**
 * Snap-back behavior for number inputs whose value drives a log payload.
 *
 * When the user backspaces the field to empty, this hook's `onBlur` handler
 * restores the most recent non-zero value the user committed. The intent is:
 * a visible field should ALWAYS represent the number that gets logged — no
 * placeholder text that disappears on focus and leaves the user wondering
 * whether anything will be saved.
 *
 * Usage:
 *   const snap = useSnapBack(servings, setServings, 1);
 *   <input value={snap.value} onChange={snap.onChange} onBlur={snap.onBlur} />
 *
 * `fallback` is the value used when the field opens (initialize state to it
 * separately) and when there's no prior committed value. Pass the current
 * "best guess" — e.g. OFF's serving_g for a serving-size field — and the hook
 * keeps track of subsequent user edits.
 */
export function useSnapBack(
  current: number | "",
  setter: (v: number | "") => void,
  fallback: number,
) {
  const lastValid = useRef<number>(
    typeof current === "number" && current > 0 ? current : fallback,
  );

  // Track new valid values as the user types so blur restores their work,
  // not the original fallback. The effect runs every render; cheap and
  // matches React's `useEffect` semantics for syncing refs to props/state.
  useEffect(() => {
    if (typeof current === "number" && current > 0) {
      lastValid.current = current;
    }
  }, [current]);

  return {
    value: current,
    onChange: (raw: string) => {
      if (raw === "") {
        setter("");
        return;
      }
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) setter(n);
    },
    onBlur: () => {
      if (current === "" || (typeof current === "number" && current <= 0)) {
        setter(lastValid.current);
      }
    },
  };
}
