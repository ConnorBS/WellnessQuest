"use client";

import { FormEvent, useState } from "react";

import { useFeatures, useToggleFeature } from "@/hooks/useFeatures";
import { useMe } from "@/hooks/useMe";
import { useUpdateMe } from "@/hooks/useUpdateMe";
import { useWeightSummary } from "@/hooks/useWeight";
import {
  useAddWeightTarget,
  useDeleteWeightTarget,
  useWeightTargets,
} from "@/hooks/useWeightTargets";
import { displayToKg, formatWeight, kgToDisplay } from "@/lib/units";

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  background: "#10b981",
  color: "#0b1220",
  border: 0,
  borderRadius: 6,
  fontWeight: 600,
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 13,
};

const dangerBtn: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  color: "#fca5a5",
  border: "1px solid #7f1d1d",
  borderRadius: 6,
  fontSize: 12,
};

export default function WeightSettingsPage() {
  const { data: me } = useMe();
  const updateMe = useUpdateMe();
  const { isEnabled } = useFeatures();
  const toggleFeature = useToggleFeature();
  const summary = useWeightSummary();
  const targets = useWeightTargets(60);
  const addTarget = useAddWeightTarget();
  const deleteTarget = useDeleteWeightTarget();

  const unit = me?.weight_unit ?? "kg";
  const current = summary.data?.current_target ?? null;

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!me) {
    return (
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <p style={{ color: "#94a3b8" }}>Loading…</p>
      </section>
    );
  }

  function saveTarget(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v = parseFloat(draft);
    if (!Number.isFinite(v) || v <= 0) {
      setError("Enter a positive target.");
      return;
    }
    const kg = displayToKg(v, unit);
    addTarget.mutate(
      { target_kg: Number(kg.toFixed(2)) },
      {
        onSuccess: () => setDraft(""),
        onError: () => setError("Could not save — try again."),
      },
    );
  }

  function clearTarget() {
    addTarget.mutate(
      { target_kg: null },
      {
        onError: () => setError("Could not save — try again."),
      },
    );
  }

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Target weight
        </h2>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 12px" }}>
          {current && current.target_kg != null ? (
            <>
              Current: <strong style={{ color: "#e2e8f0" }}>{formatWeight(current.target_kg, unit)}</strong>
              <span style={{ color: "#64748b" }}>
                {" "}
                · set {new Date(current.effective_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </>
          ) : current ? (
            <>
              No active target (cleared{" "}
              {new Date(current.effective_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })})
            </>
          ) : (
            <>No target set yet.</>
          )}
        </p>
        <form onSubmit={saveTarget} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            step="0.1"
            min="0"
            max="999"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={unit === "lb" ? "e.g. 170.0" : "e.g. 77.0"}
            style={{ width: 140 }}
          />
          <span style={{ color: "#94a3b8" }}>{unit}</span>
          <button type="submit" disabled={addTarget.isPending} style={primaryBtn}>
            {addTarget.isPending ? "Saving…" : "Save new target"}
          </button>
          {current && current.target_kg != null && (
            <button
              type="button"
              onClick={clearTarget}
              style={ghostBtn}
              disabled={addTarget.isPending}
            >
              Clear target
            </button>
          )}
        </form>
        {error && <p style={{ color: "#fca5a5", fontSize: 13, marginTop: 6 }}>{error}</p>}
        <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          Each save creates a new history row so you can graph your goal alongside your weight later.
          &quot;Clear target&quot; records that you intentionally stopped tracking a goal as of now.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Target history
        </h2>
        {targets.isLoading ? (
          <p style={{ color: "#94a3b8" }}>Loading…</p>
        ) : !targets.data || targets.data.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No history yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {targets.data.map((t) => (
              <li
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid #1e293b",
                  gap: 8,
                }}
              >
                <div>
                  <span style={{ fontWeight: 500 }}>
                    {t.target_kg != null
                      ? formatWeight(t.target_kg, unit)
                      : <span style={{ color: "#94a3b8" }}>No target (cleared)</span>}
                  </span>
                  <span style={{ color: "#94a3b8", fontSize: 12, marginLeft: 8 }}>
                    {new Date(t.effective_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Remove this target history entry?")) deleteTarget.mutate(t.id);
                  }}
                  style={dangerBtn}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Dashboard
        </h2>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={isEnabled("weight")}
            disabled={toggleFeature.isPending}
            onChange={(e) =>
              toggleFeature.mutate({ key: "weight", enabled: e.target.checked })
            }
          />
          Enable Weight tracker
        </label>
        <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          Turning this off hides the Weight card, nav link, and this settings page. Manage
          all trackers under Settings → Trackers.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Trend display
        </h2>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={me.show_raw_weight_delta}
            disabled={updateMe.isPending}
            onChange={(e) => updateMe.mutate({ show_raw_weight_delta: e.target.checked })}
          />
          Show raw day-to-day delta
        </label>
        <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          Day-to-day weight swings 1–3 lb from water and food — the smoothed
          trend is a much better signal of progress. Leave this off unless you
          find the raw number motivating.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Achievements
        </h2>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={me.weight_titles_opt_out}
            disabled={updateMe.isPending}
            onChange={(e) => updateMe.mutate({ weight_titles_opt_out: e.target.checked })}
          />
          Opt out of weight-related titles
        </label>
        <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          Hides titles tied to weight milestones. You can turn this back on
          any time.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Units
        </h2>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, flexWrap: "wrap" }}>
          <span style={{ minWidth: 100 }}>Weight unit</span>
          <select
            value={me.weight_unit}
            disabled={updateMe.isPending}
            onChange={(e) => updateMe.mutate({ weight_unit: e.target.value as "kg" | "lb" })}
            style={{ minWidth: 120 }}
          >
            <option value="kg">Kilograms (kg)</option>
            <option value="lb">Pounds (lb)</option>
          </select>
        </label>
        <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          Entries are stored as kg internally; this only changes how they are shown.
        </p>
      </section>
    </>
  );
}
