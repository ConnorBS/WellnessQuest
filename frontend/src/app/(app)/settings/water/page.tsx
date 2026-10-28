"use client";

import { useEffect, useState } from "react";

import { PresetForm } from "@/components/water/PresetForm";
import { PresetIcon } from "@/components/presets/PresetIcon";
import { useUpdateWaterGoal } from "@/hooks/useWaterGoal";
import {
  useCreatePreset,
  useDeletePreset,
  useUpdatePreset,
  useWaterPresets,
} from "@/hooks/useWaterPresets";
import { useWaterToday } from "@/hooks/useWaterToday";
import type { WaterPreset } from "@/lib/schemas";

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

const dangerBtn: React.CSSProperties = {
  padding: "6px 10px",
  background: "transparent",
  color: "#fca5a5",
  border: "1px solid #7f1d1d",
  borderRadius: 6,
  fontSize: 13,
};

const ghostBtn: React.CSSProperties = {
  padding: "6px 10px",
  background: "transparent",
  color: "var(--wq-muted)",
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
  fontSize: 13,
};

export default function WaterSettingsPage() {
  const today = useWaterToday();
  const presets = useWaterPresets();
  const updateGoal = useUpdateWaterGoal();
  const createPreset = useCreatePreset();
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();

  const [goalDraft, setGoalDraft] = useState<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (today.data?.goal_ml) setGoalDraft(today.data.goal_ml);
  }, [today.data?.goal_ml]);

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Daily water goal
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            min={1}
            max={20000}
            value={goalDraft || ""}
            onChange={(e) => setGoalDraft(Number(e.target.value) || 0)}
            style={inputStyle}
          />
          <span style={{ color: "var(--wq-muted)" }}>ml / day</span>
          <button
            type="button"
            disabled={
              !goalDraft ||
              goalDraft === today.data?.goal_ml ||
              updateGoal.isPending
            }
            onClick={() => updateGoal.mutate(goalDraft)}
            style={primaryBtn}
          >
            {updateGoal.isPending ? "Saving…" : "Save"}
          </button>
        </div>
        <p style={{ marginTop: 8, color: "var(--wq-muted-2)", fontSize: 13 }}>
          The progress bar on the Water page tracks against this target.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 className="text-lg font-semibold">Quick-add buttons</h2>
          {!showCreate && (
            <button type="button" onClick={() => setShowCreate(true)} style={primaryBtn}>
              Add preset
            </button>
          )}
        </header>

        {showCreate && (
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--wq-surface-2)" }}>
            <PresetForm
              busy={createPreset.isPending}
              onCancel={() => setShowCreate(false)}
              onSubmit={(values) =>
                createPreset.mutate(
                  { ...values, sort_order: presets.data?.length ?? 0 },
                  { onSuccess: () => setShowCreate(false) },
                )
              }
            />
          </div>
        )}

        {presets.isLoading ? (
          <p style={{ color: "var(--wq-muted)" }}>Loading…</p>
        ) : !presets.data || presets.data.length === 0 ? (
          <p style={{ color: "var(--wq-muted)" }}>No presets yet. Add one to put a button on the Water page.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {presets.data.map((p) => (
              <li key={p.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {editingId === p.id ? (
                  <PresetForm
                    initial={p}
                    busy={updatePreset.isPending}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) =>
                      updatePreset.mutate(
                        { ...values, id: p.id },
                        { onSuccess: () => setEditingId(null) },
                      )
                    }
                  />
                ) : (
                  <PresetRow
                    preset={p}
                    onEdit={() => setEditingId(p.id)}
                    onDelete={() => {
                      if (confirm(`Delete "${p.label}"?`)) deletePreset.mutate(p.id);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function PresetRow({
  preset,
  onEdit,
  onDelete,
}: {
  preset: WaterPreset;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 10,
        border: "1px solid var(--wq-surface-2)",
        borderRadius: 8,
      }}
    >
      <div style={{ flex: "0 0 auto", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PresetIcon preset={preset} size={36} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>{preset.label}</div>
        <div style={{ color: "var(--wq-muted)", fontSize: 13 }}>{preset.volume_ml} ml</div>
      </div>
      <button type="button" onClick={onEdit} style={ghostBtn}>
        Edit
      </button>
      <button type="button" onClick={onDelete} style={dangerBtn}>
        Delete
      </button>
    </div>
  );
}
