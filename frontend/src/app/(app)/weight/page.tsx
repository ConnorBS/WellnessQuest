"use client";

import { useState } from "react";

import { EditWeightEntryDrawer } from "@/components/weight/EditWeightEntryDrawer";
import { WeightForm } from "@/components/weight/WeightForm";
import { WeightSparkline } from "@/components/weight/WeightSparkline";
import { useMe } from "@/hooks/useMe";
import { useDeleteWeight, useWeightHistory } from "@/hooks/useWeight";
import type { WeightEntry } from "@/lib/schemas";
import { formatWeight } from "@/lib/units";

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "#10b981",
  color: "#0b1220",
  border: 0,
  borderRadius: 6,
  fontWeight: 500,
};

const dangerBtn: React.CSSProperties = {
  padding: "4px 8px",
  background: "transparent",
  color: "#fca5a5",
  border: "1px solid #7f1d1d",
  borderRadius: 6,
  fontSize: 12,
};

const subtleBtn: React.CSSProperties = {
  padding: "4px 8px",
  background: "transparent",
  color: "#cbd5e1",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 12,
};

export default function WeightPage() {
  const { data: me } = useMe();
  const history = useWeightHistory(180);
  const del = useDeleteWeight();
  const unit = me?.weight_unit ?? "kg";
  const [showForm, setShowForm] = useState(true);
  const [editing, setEditing] = useState<WeightEntry | null>(null);

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 className="text-lg font-semibold">Log weight</h2>
          <button type="button" onClick={() => setShowForm((v) => !v)} style={primaryBtn}>
            {showForm ? "Hide" : "Add entry"}
          </button>
        </header>
        {showForm && (
          <WeightForm unit={unit} onSaved={() => { /* keep form open; cache invalidation refreshes */ }} />
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          History
        </h2>
        {history.isLoading ? (
          <p style={{ color: "#94a3b8" }}>Loading…</p>
        ) : !history.data || history.data.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No entries yet.</p>
        ) : (
          <>
            {history.data.length >= 2 && (
              <div style={{ marginBottom: 12 }}>
                <WeightSparkline entries={history.data} unit={unit} height={120} />
              </div>
            )}
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {history.data.map((e) => (
                <li
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #1e293b",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 500 }}>{formatWeight(e.weight_kg, unit)}</span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>
                      {new Date(e.occurred_at).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => setEditing(e)} style={subtleBtn}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this entry?")) del.mutate(e.id);
                      }}
                      style={dangerBtn}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {editing ? (
        <EditWeightEntryDrawer
          entry={editing}
          unit={unit}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
