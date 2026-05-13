"use client";

import { useEffect, useMemo, useState } from "react";

import { useAddActivity } from "@/hooks/useAddActivity";
import { useCreateActivityPreset } from "@/hooks/useActivityPresets";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { ApiError } from "@/lib/api";
import { uuidv4 } from "@/lib/uuid";

interface Props {
  onClose: () => void;
}

// Same seed list the preset form (settings/activity) uses, so the dropdown
// in the modal looks consistent with the preset builder.
const EXERCISE_TYPE_SEEDS = [
  "Walking",
  "Running",
  "Cycling",
  "Swimming",
  "Hiking",
  "Yoga",
  "Pilates",
  "Weights",
  "Cardio",
  "Stretching",
  "HIIT",
  "Sports",
  "Chores",
];

export function ActivityLogModal({ onClose }: Props) {
  const [name, setName] = useState("");
  const [exerciseType, setExerciseType] = useState("");
  const [minutes, setMinutes] = useState<number | "">("");
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const add = useAddActivity();
  const createPreset = useCreateActivityPreset();
  const recent = useRecentActivity(12);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Two separate dropdowns: one of distinct past *names*, one of distinct past
  // *exercise types*. Both derive from the same /recent fetch. History wins
  // over seed suggestions so the user's own labels float to the top of the
  // exercise-type dropdown; the name dropdown has no seeds because there's no
  // sensible default for a free-form label.
  const { nameSuggestions, typeSuggestions } = useMemo(() => {
    const names = new Map<string, string>();
    const types = new Map<string, string>();
    for (const r of recent.data ?? []) {
      if (r.name) {
        const key = r.name.trim().toLowerCase();
        if (key && !names.has(key)) names.set(key, r.name.trim());
      }
      if (r.exercise_type) {
        const key = r.exercise_type.trim().toLowerCase();
        if (key && !types.has(key)) types.set(key, r.exercise_type.trim());
      }
    }
    for (const seed of EXERCISE_TYPE_SEEDS) {
      const key = seed.toLowerCase();
      if (!types.has(key)) types.set(key, seed);
    }
    return {
      nameSuggestions: Array.from(names.values()),
      typeSuggestions: Array.from(types.values()),
    };
  }, [recent.data]);

  const minutesNum = typeof minutes === "number" ? minutes : Number(minutes);
  const valid =
    Number.isFinite(minutesNum) && minutesNum >= 1 && minutesNum <= 1440;

  function handleLog() {
    if (!valid) return;
    setErrorMsg(null);
    const trimmedName = name.trim();
    const trimmedType = exerciseType.trim();
    const entryName = trimmedName ? trimmedName.slice(0, 60) : null;
    const entryType = trimmedType ? trimmedType.slice(0, 60) : null;
    const roundedMinutes = Math.round(minutesNum);
    add.mutate(
      {
        minutes: roundedMinutes,
        client_id: uuidv4(),
        exercise_type: entryType,
        name: entryName,
      },
      {
        onSuccess: () => {
          // "Save as quick activity" creates a preset whose label is the
          // entry's name when present, the exercise type otherwise, falling
          // back to a "X min" label so the button has *something* to display.
          if (saveAsPreset) {
            const label = entryName ?? entryType ?? `${roundedMinutes} min`;
            createPreset.mutate({
              label,
              minutes: roundedMinutes,
              exercise_type: entryType,
              icon_kind: "none",
              icon_key: null,
              sort_order: 0,
            });
          }
          onClose();
        },
        onError: (err) => setErrorMsg(formatLogError(err)),
      },
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Log activity"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 12,
          padding: 16,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Log activity</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              color: "#94a3b8",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            <span style={labelStyle}>
              Name <span style={{ color: "#64748b" }}>(optional)</span>
            </span>
            <input
              type="text"
              maxLength={60}
              placeholder="e.g. Morning walk, Quick lunch run"
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="activity-name-suggestions"
              style={inputStyle}
              data-testid="activity-log-name"
            />
            <datalist id="activity-name-suggestions">
              {nameSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>

          <label>
            <span style={labelStyle}>
              Exercise type <span style={{ color: "#64748b" }}>(optional)</span>
            </span>
            <input
              type="text"
              maxLength={60}
              placeholder="e.g. Walking, Yoga, Chores"
              value={exerciseType}
              onChange={(e) => setExerciseType(e.target.value)}
              list="activity-type-suggestions-modal"
              style={inputStyle}
              data-testid="activity-log-type"
            />
            <datalist id="activity-type-suggestions-modal">
              {typeSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>

          <label>
            <span style={labelStyle}>Minutes</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              placeholder="e.g. 30"
              value={minutes}
              onChange={(e) =>
                setMinutes(e.target.value === "" ? "" : Number(e.target.value))
              }
              style={inputStyle}
              data-testid="activity-log-minutes"
            />
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "#cbd5e1",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={saveAsPreset}
              onChange={(e) => setSaveAsPreset(e.target.checked)}
            />
            Save as quick activity button
          </label>

          {errorMsg ? (
            <p
              role="alert"
              data-testid="activity-log-error"
              style={{
                margin: 0,
                padding: "8px 10px",
                fontSize: 13,
                color: "#fca5a5",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.35)",
                borderRadius: 6,
              }}
            >
              {errorMsg}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleLog}
            disabled={!valid || add.isPending}
            data-testid="activity-log-submit"
            style={{
              background: !valid || add.isPending ? "#1e293b" : "#10b981",
              color: !valid || add.isPending ? "#64748b" : "white",
              border: "none",
              borderRadius: 6,
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 600,
              cursor: !valid || add.isPending ? "not-allowed" : "pointer",
              opacity: !valid || add.isPending ? 0.7 : 1,
            }}
          >
            {add.isPending ? "Logging…" : "Log it"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatLogError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
    return `Server error ${err.status}`;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Couldn't reach the server. Check your connection and try again.";
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 14,
};
