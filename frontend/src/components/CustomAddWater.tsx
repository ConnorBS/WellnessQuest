"use client";

import { FormEvent, useState } from "react";

import { useAddWater } from "@/hooks/useAddWater";
import { uuidv4 } from "@/lib/uuid";

const inputStyle: React.CSSProperties = {
  padding: 8,
  background: "var(--wq-surface)",
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
  color: "inherit",
  fontSize: 14,
};

export function CustomAddWater() {
  const add = useAddWater();
  const [ml, setMl] = useState<string>("");

  const parsed = Number(ml);
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= 10000;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    add.mutate(
      { ml: Math.round(parsed), client_id: uuidv4() },
      { onSuccess: () => setMl("") },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="custom-add-water"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 8,
        marginTop: 12,
        alignItems: "center",
      }}
    >
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={10000}
        placeholder="Milliliters"
        aria-label="Milliliters"
        value={ml}
        onChange={(e) => setMl(e.target.value)}
        style={inputStyle}
      />
      <button
        type="submit"
        disabled={!valid || add.isPending}
        className="wq-tap rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 active:bg-slate-800 disabled:opacity-50"
      >
        Log
      </button>
    </form>
  );
}
