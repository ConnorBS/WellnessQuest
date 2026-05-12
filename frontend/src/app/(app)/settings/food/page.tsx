"use client";

import { useEffect, useState } from "react";

import { PresetForm } from "@/components/food/PresetForm";
import { PresetIcon } from "@/components/presets/PresetIcon";
import { useUpdateFoodGoal } from "@/hooks/useFoodGoal";
import {
  useCreateFoodPreset,
  useDeleteFoodPreset,
  useFoodPresets,
  useUpdateFoodPreset,
} from "@/hooks/useFoodPresets";
import { useFoodToday } from "@/hooks/useFoodToday";
import type { FoodPreset } from "@/lib/schemas";

const inputStyle: React.CSSProperties = {
  padding: 8,
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "inherit",
  width: 120,
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "#10b981",
  color: "#0b1220",
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
  color: "#94a3b8",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 13,
};

export default function FoodSettingsPage() {
  const today = useFoodToday();
  const presets = useFoodPresets();
  const updateGoal = useUpdateFoodGoal();
  const createPreset = useCreateFoodPreset();
  const updatePreset = useUpdateFoodPreset();
  const deletePreset = useDeleteFoodPreset();

  const [goalDraft, setGoalDraft] = useState<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (today.data?.target_kcal) setGoalDraft(today.data.target_kcal);
  }, [today.data?.target_kcal]);

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Daily calorie ceiling
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
          <span style={{ color: "#94a3b8" }}>kcal / day</span>
          <button
            type="button"
            disabled={
              !goalDraft ||
              goalDraft === today.data?.target_kcal ||
              updateGoal.isPending
            }
            onClick={() => updateGoal.mutate(goalDraft)}
            style={primaryBtn}
          >
            {updateGoal.isPending ? "Saving…" : "Save"}
          </button>
        </div>
        <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          The food bar turns red and a <code>food.target_exceeded</code> event fires when
          today&apos;s total crosses this ceiling.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
          }}
        >
          <h2 className="text-lg font-semibold">Quick foods</h2>
          {!showCreate && (
            <button type="button" onClick={() => setShowCreate(true)} style={primaryBtn}>
              Add quick food
            </button>
          )}
        </header>

        {showCreate && (
          <div
            style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #1e293b" }}
          >
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
          <p style={{ color: "#94a3b8" }}>Loading…</p>
        ) : !presets.data || presets.data.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>
            No quick foods yet. Add one to put a one-tap button on the Food page.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
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
  preset: FoodPreset;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const macros = [
    preset.protein_g != null ? `P ${fmtMacro(preset.protein_g)}` : null,
    preset.carbs_g != null ? `C ${fmtMacro(preset.carbs_g)}` : null,
    preset.fat_g != null ? `F ${fmtMacro(preset.fat_g)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 10,
        border: "1px solid #1e293b",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          width: 44,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <PresetIcon preset={preset} size={36} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>
          {preset.label}
          {preset.brand ? <span style={{ color: "#64748b" }}> · {preset.brand}</span> : null}
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13 }}>
          {preset.kcal} kcal
          {preset.meal_type ? ` · ${preset.meal_type}` : ""}
          {macros ? ` · ${macros}` : ""}
        </div>
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

function fmtMacro(v: number): string {
  return v >= 10 ? `${Math.round(v)}g` : `${v.toFixed(1)}g`;
}
