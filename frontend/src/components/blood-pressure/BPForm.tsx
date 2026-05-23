"use client";

import { FormEvent, useState } from "react";

import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { useAddBP } from "@/hooks/useBloodPressure";

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

const numberInput: React.CSSProperties = {
  width: 90,
  padding: "8px",
};

export function BPForm({ onSaved }: Props) {
  const add = useAddBP();
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const sys = parseInt(systolic, 10);
    const dia = parseInt(diastolic, 10);
    if (!Number.isFinite(sys) || sys < 1 || sys > 299) {
      setError("Enter a systolic value between 1 and 299.");
      return;
    }
    if (!Number.isFinite(dia) || dia < 1 || dia > 199) {
      setError("Enter a diastolic value between 1 and 199.");
      return;
    }
    if (sys <= dia) {
      setError("Systolic must be greater than diastolic.");
      return;
    }
    let pulseNum: number | null = null;
    if (pulse.trim() !== "") {
      const p = parseInt(pulse, 10);
      if (!Number.isFinite(p) || p < 1 || p > 299) {
        setError("Pulse must be between 1 and 299 (or leave blank).");
        return;
      }
      pulseNum = p;
    }
    add.mutate(
      {
        systolic: sys,
        diastolic: dia,
        pulse: pulseNum,
        note: note.trim() || null,
        ...(occurredAt ? { occurred_at: occurredAt } : {}),
      },
      {
        onSuccess: () => {
          setPulse("");
          setNote("");
          setOccurredAt(null);
          setError(null);
          onSaved?.();
        },
        onError: () => setError("Could not save — try again."),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>Systolic</span>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            max="299"
            required
            value={systolic}
            onChange={(e) => setSystolic(e.target.value)}
            placeholder="120"
            style={numberInput}
          />
        </label>
        <span style={{ color: "#64748b", alignSelf: "flex-end", paddingBottom: 8 }}>/</span>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>Diastolic</span>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            max="199"
            required
            value={diastolic}
            onChange={(e) => setDiastolic(e.target.value)}
            placeholder="80"
            style={numberInput}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>Pulse (optional)</span>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            max="299"
            value={pulse}
            onChange={(e) => setPulse(e.target.value)}
            placeholder="72"
            style={numberInput}
          />
        </label>
        <span style={{ color: "#94a3b8", fontSize: 12, alignSelf: "flex-end", paddingBottom: 12 }}>
          mmHg
        </span>
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (e.g. morning, post-exercise)"
        maxLength={500}
      />
      <OccurredAtField value={occurredAt} onChange={setOccurredAt} />
      {error && <p style={{ color: "#fca5a5", fontSize: 13 }}>{error}</p>}
      <button type="submit" disabled={add.isPending} style={primaryBtn}>
        {add.isPending ? "Saving…" : "Log reading"}
      </button>
    </form>
  );
}
