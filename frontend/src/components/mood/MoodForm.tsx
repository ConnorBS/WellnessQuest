"use client";

import { FormEvent, useState } from "react";

import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { MoodPicker } from "@/components/mood/MoodPicker";
import { useAddMood } from "@/hooks/useMood";
import { ENERGY_LABELS } from "@/lib/mood";
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
  const [moods, setMoods] = useState<MoodValue[]>([]);
  const [energy, setEnergy] = useState(2);
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (moods.length === 0) {
      setError("Pick how you're feeling.");
      return;
    }
    add.mutate(
      {
        moods,
        energy,
        note: note.trim() || null,
        ...(occurredAt ? { occurred_at: occurredAt } : {}),
      },
      {
        onSuccess: () => {
          setMoods([]);
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
        <span style={{ color: "#94a3b8", fontSize: 12 }}>
          What are you feeling right now? Pick as many as fit — strongest first.
        </span>
        <div style={{ marginTop: 6 }}>
          <MoodPicker value={moods} onChange={setMoods} />
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
