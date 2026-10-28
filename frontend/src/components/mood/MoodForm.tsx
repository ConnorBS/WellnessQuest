"use client";

import { FormEvent, useState } from "react";

import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { MoodPicker } from "@/components/mood/MoodPicker";
import { useAddMood } from "@/hooks/useMood";
import { ENERGY_LABELS, MOOD_NOTE_MAX, noteTextarea } from "@/lib/mood";
import type { MoodValue } from "@/lib/schemas";

interface Props {
  onSaved?: () => void;
}

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  background: "var(--wq-accent)",
  color: "var(--wq-on-accent)",
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
        <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>
          What are you feeling right now? Pick as many as fit — strongest first.
        </span>
        <div style={{ marginTop: 6 }}>
          <MoodPicker value={moods} onChange={setMoods} />
        </div>
      </div>

      <div>
        <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>Energy</span>
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
                border: energy === lvl ? "2px solid var(--wq-accent)" : "1px solid var(--wq-border)",
                background: energy === lvl ? "var(--wq-accent)22" : "transparent",
                color: "var(--wq-text)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {ENERGY_LABELS[lvl]}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notes — what's happening, where you feel it, what set it off (optional)"
        maxLength={MOOD_NOTE_MAX}
        style={noteTextarea}
      />
      <OccurredAtField value={occurredAt} onChange={setOccurredAt} />
      {error && <p style={{ color: "#fca5a5", fontSize: 13 }}>{error}</p>}
      <button type="submit" disabled={add.isPending} style={primaryBtn}>
        {add.isPending ? "Saving…" : "Log mood"}
      </button>
    </form>
  );
}
