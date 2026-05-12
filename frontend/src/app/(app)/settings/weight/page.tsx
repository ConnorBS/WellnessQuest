"use client";

import { useMe } from "@/hooks/useMe";
import { useUpdateMe } from "@/hooks/useUpdateMe";

export default function WeightSettingsPage() {
  const { data: me } = useMe();
  const updateMe = useUpdateMe();

  if (!me) {
    return (
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <p style={{ color: "#94a3b8" }}>Loading…</p>
      </section>
    );
  }

  return (
    <>
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
          Entries are stored as kg internally; this only changes how they're shown.
        </p>
      </section>
    </>
  );
}
