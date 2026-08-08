"use client";

import { FormEvent, useState } from "react";

import { useBPSummary } from "@/hooks/useBloodPressure";
import {
  useAddBPTarget,
  useBPTargets,
  useDeleteBPTarget,
} from "@/hooks/useBPTargets";
import { useFeatures, useToggleFeature } from "@/hooks/useFeatures";
import { useMe } from "@/hooks/useMe";
import { useUpdateMe } from "@/hooks/useUpdateMe";

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

const numberInput: React.CSSProperties = {
  width: 80,
  padding: "8px",
};

export default function BPSettingsPage() {
  const { data: me } = useMe();
  const updateMe = useUpdateMe();
  const { isEnabled } = useFeatures();
  const toggleFeature = useToggleFeature();
  const summary = useBPSummary();
  const targets = useBPTargets(60);
  const addTarget = useAddBPTarget();
  const deleteTarget = useDeleteBPTarget();

  const current = summary.data?.current_target ?? null;
  const currentSet =
    current != null && current.target_systolic != null && current.target_diastolic != null;

  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
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
    const s = parseInt(sys, 10);
    const d = parseInt(dia, 10);
    if (!Number.isFinite(s) || s < 1 || s > 299) {
      setError("Enter a systolic value between 1 and 299.");
      return;
    }
    if (!Number.isFinite(d) || d < 1 || d > 199) {
      setError("Enter a diastolic value between 1 and 199.");
      return;
    }
    if (s <= d) {
      setError("Systolic must be greater than diastolic.");
      return;
    }
    addTarget.mutate(
      { target_systolic: s, target_diastolic: d },
      {
        onSuccess: () => {
          setSys("");
          setDia("");
        },
        onError: () => setError("Could not save — try again."),
      },
    );
  }

  function clearTarget() {
    addTarget.mutate(
      { target_systolic: null, target_diastolic: null },
      {
        onError: () => setError("Could not save — try again."),
      },
    );
  }

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Target blood pressure
        </h2>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 12px" }}>
          {currentSet ? (
            <>
              Current:{" "}
              <strong style={{ color: "#e2e8f0" }}>
                {current!.target_systolic}/{current!.target_diastolic} mmHg
              </strong>
              <span style={{ color: "#64748b" }}>
                {" "}· set{" "}
                {new Date(current!.effective_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </>
          ) : current ? (
            <>
              No active target (cleared{" "}
              {new Date(current.effective_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              )
            </>
          ) : (
            <>No target set yet.</>
          )}
        </p>
        <form onSubmit={saveTarget} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            max="299"
            value={sys}
            onChange={(e) => setSys(e.target.value)}
            placeholder="130"
            style={numberInput}
            aria-label="Target systolic"
          />
          <span style={{ color: "#64748b" }}>/</span>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            max="199"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            placeholder="80"
            style={numberInput}
            aria-label="Target diastolic"
          />
          <span style={{ color: "#94a3b8" }}>mmHg</span>
          <button type="submit" disabled={addTarget.isPending} style={primaryBtn}>
            {addTarget.isPending ? "Saving…" : "Save new target"}
          </button>
          {currentSet && (
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
          Each save creates a new history row so you can see how your goal has changed over time.
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
                    {t.target_systolic != null && t.target_diastolic != null ? (
                      <>
                        {t.target_systolic}/{t.target_diastolic}{" "}
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>mmHg</span>
                      </>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>No target (cleared)</span>
                    )}
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
            checked={isEnabled("blood_pressure")}
            disabled={toggleFeature.isPending}
            onChange={(e) =>
              toggleFeature.mutate({ key: "blood_pressure", enabled: e.target.checked })
            }
          />
          Enable Blood pressure tracker
        </label>
        <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          Turning this off hides the Blood pressure card, nav link, and this settings page.
          Manage all trackers under Settings → Trackers.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Reading display
        </h2>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={me.show_bp_category}
            disabled={updateMe.isPending}
            onChange={(e) => updateMe.mutate({ show_bp_category: e.target.checked })}
          />
          Tag readings with a category
        </label>
        <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          Shows the coloured Normal / Elevated / Stage 1 / Stage 2 / Crisis chip
          (AHA 2017 ranges) next to each reading on the dashboard card and the
          history list. Turn it off to see just the numbers — your readings and
          target comparison are unchanged either way.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Achievements
        </h2>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={me.bp_titles_opt_out}
            disabled={updateMe.isPending}
            onChange={(e) => updateMe.mutate({ bp_titles_opt_out: e.target.checked })}
          />
          Opt out of blood pressure titles
        </label>
        <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          Hides titles tied to blood pressure milestones. You can turn this
          back on any time.
        </p>
      </section>
    </>
  );
}
