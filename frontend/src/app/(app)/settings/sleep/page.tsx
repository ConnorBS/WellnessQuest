"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useSleepLast } from "@/hooks/useSleepLast";
import { useUpdateSleepGoal } from "@/hooks/useSleepGoal";
import { formatDuration } from "@/lib/duration";

const inputStyle: React.CSSProperties = {
  padding: 8,
  background: "var(--wq-surface)",
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
  color: "inherit",
  width: 70,
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "var(--wq-accent)",
  color: "var(--wq-on-accent)",
  border: 0,
  borderRadius: 6,
  fontWeight: 500,
};

// Stored as minutes, but nobody thinks about sleep in minutes — the form is
// hours + minutes and converts on save.
const SUGGESTIONS = [360, 420, 450, 480, 540];

export default function SleepSettingsPage() {
  const last = useSleepLast();
  const updateGoal = useUpdateSleepGoal();
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(0);

  const current = last.data?.goal_minutes;

  useEffect(() => {
    if (current) {
      setHours(Math.floor(current / 60));
      setMinutes(current % 60);
    }
  }, [current]);

  const draft = hours * 60 + minutes;
  const valid = draft >= 1 && draft <= 1440;

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Nightly sleep goal
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            type="number"
            min={0}
            max={24}
            value={hours}
            onChange={(e) => setHours(Math.max(0, Math.min(24, Number(e.target.value) || 0)))}
            style={inputStyle}
            aria-label="Goal hours"
            data-testid="sleep-goal-hours"
          />
          <span style={{ color: "var(--wq-muted)" }}>h</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
            style={inputStyle}
            aria-label="Goal minutes"
            data-testid="sleep-goal-minutes"
          />
          <span style={{ color: "var(--wq-muted)" }}>min / night</span>
          <button
            type="button"
            disabled={!valid || draft === current || updateGoal.isPending}
            onClick={() => updateGoal.mutate(draft)}
            style={primaryBtn}
            data-testid="sleep-goal-save"
          >
            {updateGoal.isPending ? "Saving…" : "Save"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {SUGGESTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setHours(Math.floor(m / 60));
                setMinutes(m % 60);
              }}
              style={{
                padding: "4px 10px",
                background: "var(--wq-surface-2)",
                color: "var(--wq-text)",
                border: "1px solid var(--wq-border)",
                borderRadius: 999,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {formatDuration(m)}
            </button>
          ))}
        </div>
        <p style={{ marginTop: 8, color: "var(--wq-muted-2)", fontSize: 13 }}>
          A session that meets this target grants a bonus and extends your sleep
          streak. Sessions are counted against the day they ended on.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Where sleep comes from
        </h2>
        <p style={{ color: "var(--wq-muted)", fontSize: 14 }}>
          Log a night by hand on the{" "}
          <Link href="/sleep" style={{ color: "var(--wq-accent)" }}>
            Sleep page
          </Link>
          , or import sessions automatically from a CPAP or wearable by connecting{" "}
          <Link href="/settings/integrations" style={{ color: "var(--wq-accent)" }}>
            Home Assistant
          </Link>
          .
        </p>
        <p style={{ color: "var(--wq-muted-2)", fontSize: 13, marginTop: 8 }}>
          Quality is optional and free-form (0–100) — nothing is computed from it.
          It is recorded so you can spot patterns.
        </p>
      </section>
    </>
  );
}
