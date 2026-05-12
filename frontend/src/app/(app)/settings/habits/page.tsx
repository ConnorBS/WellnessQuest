"use client";

import { useMemo, useState } from "react";

import { HabitForm } from "@/components/habits/HabitForm";
import { PresetIcon } from "@/components/presets/PresetIcon";
import {
  useCreateHabit,
  useDeleteHabit,
  useHabits,
  useReorderHabits,
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

const arrowBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  color: "#cbd5e1",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 16,
};

function cadenceLabel(h: Habit): string {
  if (h.cadence_kind === "daily") return "Every day";
  if (h.cadence_kind === "weekly") return `${h.weekly_target ?? "?"}× per week`;
  if (h.cadence_kind === "monthly") return `${h.monthly_target ?? "?"}× per month`;
  return `Every ${h.interval_days ?? "?"} days`;
}

export default function HabitsSettingsPage() {
  const habits = useHabits();
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();
  const reorder = useReorderHabits();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const sorted = useMemo(() => {
    if (!habits.data) return null;
    return habits.data
      .slice()
      .sort((a, b) => a.habit.sort_order - b.habit.sort_order)
      .map((h) => h.habit);
  }, [habits.data]);

  function move(index: number, delta: number) {
    if (!sorted) return;
    const next = sorted.slice();
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    reorder.mutate(next.map((h) => h.id));
  }

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
                  { ...values, sort_order: sorted?.length ?? 0 },
                  { onSuccess: () => setShowCreate(false) },
                )
              }
            />
          </div>
        )}

        {habits.isLoading ? (
          <p style={{ color: "#94a3b8" }}>Loading…</p>
        ) : !sorted || sorted.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No habits yet. Add one to get started.</p>
        ) : (
          <>
            <p style={{ color: "#64748b", fontSize: 12, marginBottom: 10 }}>
              Use ↑ / ↓ to set the order — within each Today / This week / This month section on
              the Habits page, items appear in this order.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {sorted.map((habit, idx) => (
                <li key={habit.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {editingId === habit.id ? (
                    <HabitForm
                      initial={habit}
                      busy={updateHabit.isPending}
                      onCancel={() => setEditingId(null)}
                      onSubmit={(values) =>
                        updateHabit.mutate(
                          { ...values, id: habit.id },
                          { onSuccess: () => setEditingId(null) },
                        )
                      }
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: 10,
                        border: "1px solid #1e293b",
                        borderRadius: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0 || reorder.isPending}
                          aria-label="Move up"
                          style={{ ...arrowBtn, opacity: idx === 0 ? 0.4 : 1 }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(idx, 1)}
                          disabled={idx === sorted.length - 1 || reorder.isPending}
                          aria-label="Move down"
                          style={{ ...arrowBtn, opacity: idx === sorted.length - 1 ? 0.4 : 1 }}
                        >
                          ↓
                        </button>
                      </div>
                      <div style={{ flex: "0 0 auto", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <PresetIcon preset={{ icon_kind: habit.icon_kind, icon_key: habit.icon_key }} size={32} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500 }}>{habit.name}</div>
                        <div style={{ color: "#94a3b8", fontSize: 13 }}>{cadenceLabel(habit)}</div>
                      </div>
                      <button type="button" onClick={() => setEditingId(habit.id)} style={ghostBtn}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete "${habit.name}"?`)) deleteHabit.mutate(habit.id);
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
          </>
        )}
      </section>
    </>
  );
}
