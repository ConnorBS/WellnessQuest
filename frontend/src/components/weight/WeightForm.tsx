"use client";

import { FormEvent, useState } from "react";

import { useAddWeight } from "@/hooks/useWeight";
import { displayToKg } from "@/lib/units";

interface Props {
  unit: string;
  defaultValue?: number; // in user's unit
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

export function WeightForm({ unit, defaultValue, onSaved }: Props) {
  const add = useAddWeight();
  const [val, setVal] = useState<string>(defaultValue?.toFixed(1) ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const num = parseFloat(val);
    if (!Number.isFinite(num) || num <= 0) {
      setError("Enter a positive weight.");
      return;
    }
    const kg = displayToKg(num, unit);
    add.mutate(
      { weight_kg: Number(kg.toFixed(2)), note: note.trim() || null },
      {
        onSuccess: () => {
          setNote("");
          setError(null);
          onSaved?.();
        },
        onError: () => setError("Could not save — try again."),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="number"
          step="0.1"
          min="0"
          max="999"
          required
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={unit === "lb" ? "e.g. 175.0" : "e.g. 79.5"}
          style={{ flex: 1 }}
        />
        <span style={{ color: "#94a3b8" }}>{unit}</span>
      </label>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (e.g. after workout)"
        maxLength={500}
      />
      {error && <p style={{ color: "#fca5a5", fontSize: 13 }}>{error}</p>}
      <button type="submit" disabled={add.isPending} style={primaryBtn}>
        {add.isPending ? "Saving…" : "Log weight"}
      </button>
    </form>
  );
}
