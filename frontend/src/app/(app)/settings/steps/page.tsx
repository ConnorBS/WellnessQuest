"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useStepsToday } from "@/hooks/useStepsToday";
import { useUpdateStepsGoal } from "@/hooks/useStepsGoal";

const inputStyle: React.CSSProperties = {
  padding: 8,
  background: "var(--wq-surface)",
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
  color: "inherit",
  width: 120,
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "var(--wq-accent)",
  color: "var(--wq-on-accent)",
  border: 0,
  borderRadius: 6,
  fontWeight: 500,
};

// Common daily targets. 8,000 is the app default; 10,000 is the number most
// people have heard of.
const SUGGESTIONS = [5000, 7500, 8000, 10000, 12500];

export default function StepsSettingsPage() {
  const today = useStepsToday();
  const updateGoal = useUpdateStepsGoal();
  const [goalDraft, setGoalDraft] = useState<number>(0);

  useEffect(() => {
    if (today.data?.goal) setGoalDraft(today.data.goal);
  }, [today.data?.goal]);

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Daily steps goal
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            type="number"
            min={1}
            max={200000}
            value={goalDraft || ""}
            onChange={(e) => setGoalDraft(Number(e.target.value) || 0)}
            style={inputStyle}
            data-testid="steps-goal-input"
          />
          <span style={{ color: "var(--wq-muted)" }}>steps / day</span>
          <button
            type="button"
            disabled={!goalDraft || goalDraft === today.data?.goal || updateGoal.isPending}
            onClick={() => updateGoal.mutate(goalDraft)}
            style={primaryBtn}
            data-testid="steps-goal-save"
          >
            {updateGoal.isPending ? "Saving…" : "Save"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {SUGGESTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setGoalDraft(n)}
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
              {n.toLocaleString()}
            </button>
          ))}
        </div>
        <p style={{ marginTop: 8, color: "var(--wq-muted-2)", fontSize: 13 }}>
          The progress bar on the Steps page tracks against this target. Crossing it
          once a day grants a bonus and extends your steps streak.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Where steps come from
        </h2>
        <p style={{ color: "var(--wq-muted)", fontSize: 14 }}>
          Log them by hand on the{" "}
          <Link href="/steps" style={{ color: "var(--wq-accent)" }}>
            Steps page
          </Link>
          , or import them automatically from a phone or wearable by connecting{" "}
          <Link href="/settings/integrations" style={{ color: "var(--wq-accent)" }}>
            Home Assistant
          </Link>
          . Both write to the same daily total, so you can mix the two.
        </p>
        <p style={{ color: "var(--wq-muted-2)", fontSize: 13, marginTop: 8 }}>
          Entries are stored as additions, not as a running total — logging 3,000
          adds 3,000 to the day rather than setting it.
        </p>
      </section>
    </>
  );
}
