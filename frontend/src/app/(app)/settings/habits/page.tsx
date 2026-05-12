"use client";

import { useState } from "react";

import { HabitForm } from "@/components/habits/HabitForm";
import { PresetIcon } from "@/components/presets/PresetIcon";
import {
  useCreateHabit,
  useDeleteHabit,
  useHabits,
  useUpdateHabit,
} from "@/hooks/useHabits";
import type { Habit } from "@/lib/schemas";

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

function cadenceLabel(h: Habit): string {
  if (h.cadence_kind === "daily") return "Every day";
  if (h.cadence_kind === "weekly") return `${h.weekly_target ?? "?"}× per week`;
  return `Every ${h.interval_days ?? "?"} days`;
}

export default function HabitsSettingsPage() {
  const habits = useHabits();
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 className="text-lg font-semibold">Habits</h2>
          {!showCreate && (
            <button type="button" onClick={() => setShowCreate(true)} style={primaryBtn}>
              Add habit
            </button>
          )}
        </header>

        {showCreate && (
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #1e293b" }}>
            <HabitForm
              busy={createHabit.isPending}
              onCancel={() => setShowCreate(false)}
              onSubmit={(values) =>
                createHabit.mutate(
                  { ...values, sort_order: habits.data?.length ?? 0 },
                  { onSuccess: () => setShowCreate(false) },
                )
              }
            />
          </div>
        )}

        {habits.isLoading ? (
          <p style={{ color: "#94a3b8" }}>Loading…</p>
        ) : !habits.data || habits.data.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No habits yet. Add one to get started.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {habits.data.map((item) => (
              <li key={item.habit.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {editingId === item.habit.id ? (
                  <HabitForm
                    initial={item.habit}
                    busy={updateHabit.isPending}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) =>
                      updateHabit.mutate(
                        { ...values, id: item.habit.id },
                        { onSuccess: () => setEditingId(null) },
                      )
                    }
                  />
                ) : (
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
                    <div style={{ flex: "0 0 auto", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <PresetIcon preset={{ icon_kind: item.habit.icon_kind, icon_key: item.habit.icon_key }} size={32} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{item.habit.name}</div>
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>{cadenceLabel(item.habit)}</div>
                    </div>
                    <button type="button" onClick={() => setEditingId(item.habit.id)} style={ghostBtn}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete "${item.habit.name}"?`)) deleteHabit.mutate(item.habit.id);
                      }}
                      style={dangerBtn}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
