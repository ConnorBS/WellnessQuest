"use client";

import { FormEvent, useEffect, useState } from "react";

import { useMe } from "@/hooks/useMe";
import { useUpdateMe } from "@/hooks/useUpdateMe";
import { displayToKg, kgToDisplay } from "@/lib/units";

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "#10b981",
  color: "#0b1220",
  border: 0,
  borderRadius: 6,
  fontWeight: 500,
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 13,
};

export default function WeightSettingsPage() {
  const { data: me } = useMe();
  const updateMe = useUpdateMe();
  const unit = me?.weight_unit ?? "kg";

  const [targetDraft, setTargetDraft] = useState<string>("");
  const [targetError, setTargetError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    if (me.weight_target_kg == null) {
      setTargetDraft("");
    } else {
      setTargetDraft(kgToDisplay(me.weight_target_kg, unit).toFixed(1));
    }
  }, [me, unit]);

  if (!me) {
    return (
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <p style={{ color: "#94a3b8" }}>Loading…</p>
      </section>
    );
  }

  function saveTarget(e: FormEvent) {
    e.preventDefault();
    setTargetError(null);
    const v = parseFloat(targetDraft);
    if (!Number.isFinite(v) || v <= 0) {
      setTargetError("Enter a positive target.");
      return;
    }
    const kg = displayToKg(v, unit);
    updateMe.mutate({ weight_target_kg: Number(kg.toFixed(2)) });
  }

  function clearTarget() {
    updateMe.mutate({ clear_weight_target: true });
  }

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Target weight
        </h2>
        <form onSubmit={saveTarget} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            type="number"
            step="0.1"
            min="0"
            max="999"
            value={targetDraft}
            onChange={(e) => setTargetDraft(e.target.value)}
            placeholder={unit === "lb" ? "e.g. 170.0" : "e.g. 77.0"}
            style={{ width: 140 }}
          />
          <span style={{ color: "#94a3b8" }}>{unit}</span>
          <button
            type="submit"
            disabled={updateMe.isPending}
            style={primaryBtn}
          >
            {updateMe.isPending ? "Saving…" : "Save target"}
          </button>
          {me.weight_target_kg != null && (
            <button type="button" onClick={clearTarget} style={ghostBtn} disabled={updateMe.isPending}>
              Clear
            </button>
          )}
        </form>
        {targetError && <p style={{ color: "#fca5a5", fontSize: 13, marginTop: 6 }}>{targetError}</p>}
        <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          Shown on the Weight card and the /weight page as a goal you are moving toward.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Dashboard
        </h2>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={me.show_weight_card}
            disabled={updateMe.isPending}
            onChange={(e) => updateMe.mutate({ show_weight_card: e.target.checked })}
          />
          Show Weight card on Dashboard
        </label>
        <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          The /weight page is always available from the top nav, regardless of this setting.
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
