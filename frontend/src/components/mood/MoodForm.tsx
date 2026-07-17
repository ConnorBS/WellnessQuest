"use client";

import { FormEvent, useState } from "react";

import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { useAddMood } from "@/hooks/useMood";
import { ENERGY_LABELS, MOOD_META, MOOD_ORDER } from "@/lib/mood";
import type { MoodValue } from "@/lib/schemas";

interface Props {
  onSaved?: () => void;
}

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  background: "#10b981",
  color: "#0b1220",
  border: 0,
  borderRadius: 6,
  fontWeight: 600,
};

export function MoodForm({ onSaved }: Props) {
  const add = useAddMood();
  const [mood, setMood] = useState<MoodValue | null>(null);
  const [energy, setEnergy] = useState(2);
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mood == null) {
      setError("Pick how you're feeling.");
      return;
    }
    add.mutate(
      {
        mood,
        energy,
        note: note.trim() || null,
        ...(occurredAt ? { occurred_at: occurredAt } : {}),
      },
      {
        onSuccess: () => {
          setMood(null);
          setEnergy(2);
          setNote("");
          setOccurredAt(null);
          onSaved?.();
        },
        onError: () => setError("Could not save — try again."),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <span style={{ color: "#94a3b8", fontSize: 12 }}>How are you feeling?</span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
            gap: 6,
            marginTop: 6,
          }}
        >
          {MOOD_ORDER.map((m) => {
            const meta = MOOD_META[m];
            const selected = mood === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMood(m)}
                aria-pressed={selected}
                style={{
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
                <span style={{ fontSize: 20 }}>{meta.emoji}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span style={{ color: "#94a3b8", fontSize: 12 }}>Energy</span>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {[1, 2, 3].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setEnergy(lvl)}
              aria-pressed={energy === lvl}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: 6,
                border: energy === lvl ? "2px solid #10b981" : "1px solid #334155",
                background: energy === lvl ? "#10b98122" : "transparent",
                color: "#e2e8f0",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {ENERGY_LABELS[lvl]}
            </button>
          ))}
        </div>
      </div>

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (what's on your mind?)"
        maxLength={500}
      />
      <OccurredAtField value={occurredAt} onChange={setOccurredAt} />
      {error && <p style={{ color: "#fca5a5", fontSize: 13 }}>{error}</p>}
      <button type="submit" disabled={add.isPending} style={primaryBtn}>
        {add.isPending ? "Saving…" : "Log mood"}
      </button>
    </form>
  );
}
