"use client";

import { useEffect, useMemo, useState } from "react";

import { useAddActivity } from "@/hooks/useAddActivity";
import { useCreateActivityPreset } from "@/hooks/useActivityPresets";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { uuidv4 } from "@/lib/uuid";

interface Props {
  onClose: () => void;
}

// Seed suggestions so first-time users see something when they open the
// dropdown, before they've built up any history of their own.
const SEED_SUGGESTIONS = [
  "Walking",
  "Running",
  "Cycling",
  "Swimming",
  "Hiking",
  "Yoga",
  "Weights",
  "HIIT",
  "Stretching",
  "Chores",
];

export function ActivityLogModal({ onClose }: Props) {
  const [minutes, setMinutes] = useState<number | "">("");
  const [exerciseType, setExerciseType] = useState("");
  const [saveAsPreset, setSaveAsPreset] = useState(false);

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

  // Merge user history (most-recent first) with seed suggestions, deduped
  // case-insensitively. History wins so the user's own labels float to top.
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of recent.data ?? []) {
      const key = r.exercise_type.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(r.exercise_type.trim());
    }
    for (const s of SEED_SUGGESTIONS) {
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }, [recent.data]);

  const minutesNum = typeof minutes === "number" ? minutes : Number(minutes);
  const valid =
    Number.isFinite(minutesNum) && minutesNum >= 1 && minutesNum <= 1440;

  function handleLog() {
    if (!valid) return;
    const trimmed = exerciseType.trim();
    const type = trimmed ? trimmed.slice(0, 60) : null;
    const roundedMinutes = Math.round(minutesNum);
    add.mutate(
      {
        minutes: roundedMinutes,
        client_id: uuidv4(),
        exercise_type: type,
      },
      {
        onSuccess: () => {
          // "Save as quick activity" creates a preset with the same minutes
          // and type. Label falls back to "X min" when there's no name, which
          // matches how Quick foods labels nameless entries.
          if (saveAsPreset) {
            createPreset.mutate({
              label: type ?? `${roundedMinutes} min`,
              minutes: roundedMinutes,
              exercise_type: type,
              icon_kind: "none",
              icon_key: null,
              sort_order: 0,
            });
          }
          onClose();
        },
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
            <span style={labelStyle}>Activity</span>
            <input
              type="text"
              maxLength={60}
              placeholder="e.g. Walking, Yoga, Chores"
              value={exerciseType}
              onChange={(e) => setExerciseType(e.target.value)}
              list="activity-recent-suggestions"
              style={inputStyle}
              data-testid="activity-log-name"
            />
            <datalist id="activity-recent-suggestions">
              {suggestions.map((s) => (
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
