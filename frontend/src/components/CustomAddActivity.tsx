"use client";

import { FormEvent, useState } from "react";

import { useAddActivity } from "@/hooks/useAddActivity";
import { ACTIVITY_TYPE_DATALIST_ID, ACTIVITY_TYPE_SUGGESTIONS } from "@/lib/activityTypes";
import { uuidv4 } from "@/lib/uuid";

const inputStyle: React.CSSProperties = {
  padding: 8,
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "inherit",
  fontSize: 14,
};

export function CustomAddActivity() {
  const add = useAddActivity();
  const [minutes, setMinutes] = useState<string>("");
  const [exerciseType, setExerciseType] = useState<string>("");

  const parsed = Number(minutes);
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= 1440;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const trimmed = exerciseType.trim();
    add.mutate(
      {
        minutes: Math.round(parsed),
        client_id: uuidv4(),
        exercise_type: trimmed ? trimmed.slice(0, 60) : null,
      },
      {
        onSuccess: () => {
          setMinutes("");
          setExerciseType("");
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="custom-add-activity"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(72px, 1fr) minmax(0, 2fr) auto",
        gap: 8,
        marginTop: 12,
        alignItems: "center",
      }}
    >
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={1440}
        placeholder="Minutes"
        aria-label="Minutes"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        style={inputStyle}
      />
      <input
        type="text"
        maxLength={60}
        placeholder="Activity (e.g. Biking, Chores)"
        aria-label="Activity type"
        value={exerciseType}
        onChange={(e) => setExerciseType(e.target.value)}
        list={ACTIVITY_TYPE_DATALIST_ID}
        style={inputStyle}
      />
      <datalist id={ACTIVITY_TYPE_DATALIST_ID}>
        {ACTIVITY_TYPE_SUGGESTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
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
