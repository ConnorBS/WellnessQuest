"use client";

import { useState } from "react";

import { BPCategoryChip } from "@/components/blood-pressure/BPCategoryChip";
import { BPForm } from "@/components/blood-pressure/BPForm";
import { EditBPEntryDrawer } from "@/components/blood-pressure/EditBPEntryDrawer";
import { useBPHistory, useBPSummary, useDeleteBP } from "@/hooks/useBloodPressure";
import type { BloodPressureEntry } from "@/lib/schemas";

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "var(--wq-accent)",
  color: "var(--wq-on-accent)",
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
  color: "var(--wq-text-2)",
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
  fontSize: 12,
};

export default function BloodPressurePage() {
  const history = useBPHistory(180);
  const summary = useBPSummary();
  const del = useDeleteBP();
  const [showForm, setShowForm] = useState(true);
  const [editing, setEditing] = useState<BloodPressureEntry | null>(null);

  const target = summary.data?.current_target ?? null;
  const hasTarget =
    target != null && target.target_systolic != null && target.target_diastolic != null;

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 className="text-lg font-semibold">Log a reading</h2>
          <button type="button" onClick={() => setShowForm((v) => !v)} style={primaryBtn}>
            {showForm ? "Hide" : "Add reading"}
          </button>
        </header>
        {showForm && <BPForm />}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          History
        </h2>
        {hasTarget && (
          <p style={{ color: "var(--wq-text-2)", fontSize: 13, marginBottom: 12 }}>
            Target: <strong>{target!.target_systolic}/{target!.target_diastolic}</strong> mmHg
          </p>
        )}
        {history.isLoading ? (
          <p style={{ color: "var(--wq-muted)" }}>Loading…</p>
        ) : !history.data || history.data.length === 0 ? (
          <p style={{ color: "var(--wq-muted)" }}>No entries yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {history.data.map((e) => (
              <li
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--wq-surface-2)",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 16 }}>
                      {e.systolic}/{e.diastolic}
                    </span>
                    <BPCategoryChip systolic={e.systolic} diastolic={e.diastolic} />
                    {e.pulse != null && (
                      <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>· {e.pulse} bpm</span>
                    )}
                  </div>
                  <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>
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
                      if (confirm("Delete this reading?")) del.mutate(e.id);
                    }}
                    style={dangerBtn}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {editing ? (
        <EditBPEntryDrawer entry={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
