"use client";

import { MOOD_META, MOOD_ORDER } from "@/lib/mood";
import type { MoodValue } from "@/lib/schemas";

interface Props {
  value: MoodValue[];
  onChange: (next: MoodValue[]) => void;
}

// Multi-select: tap order is kept and the first pick is treated as the
// strongest feeling (it's what the card and 30-day grid colour by). Tapping a
// selected chip removes it; tapping the strongest-marked one promotes the next.
export function MoodPicker({ value, onChange }: Props) {
  function toggle(m: MoodValue) {
    onChange(value.includes(m) ? value.filter((v) => v !== m) : [...value, m]);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
        gap: 6,
      }}
    >
      {MOOD_ORDER.map((m) => {
        const meta = MOOD_META[m];
        const idx = value.indexOf(m);
        const selected = idx !== -1;
        return (
          <button
            key={m}
            type="button"
            onClick={() => toggle(m)}
            aria-pressed={selected}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "8px 4px",
              borderRadius: 8,
              border: selected ? `2px solid ${meta.color}` : "1px solid #334155",
              background: selected ? `${meta.color}22` : "transparent",
              color: "#e2e8f0",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {idx === 0 && value.length > 1 ? (
              <span
                aria-label="strongest"
                style={{
                  position: "absolute",
                  top: 2,
                  right: 4,
                  fontSize: 10,
                  color: meta.color,
                }}
              >
                ★
              </span>
            ) : null}
            <span style={{ fontSize: 20 }}>{meta.emoji}</span>
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
