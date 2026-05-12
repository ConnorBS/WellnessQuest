"use client";

import { PresetIcon } from "@/components/presets/PresetIcon";
import { useToggleHabit } from "@/hooks/useHabits";
import type { HabitWithStatus } from "@/lib/schemas";

type Pill = { bg: string; fg: string; label: string };
const OK_PILL: Pill = { bg: "rgba(100, 116, 139, 0.2)", fg: "#cbd5e1", label: "On track" };
const STATUS_PILL: Record<string, Pill> = {
  done: { bg: "rgba(16, 185, 129, 0.15)", fg: "#6ee7b7", label: "Done" },
  ok: OK_PILL,
  due_today: { bg: "rgba(251, 191, 36, 0.15)", fg: "#fde68a", label: "Due today" },
  overdue: { bg: "rgba(248, 113, 113, 0.15)", fg: "#fca5a5", label: "Overdue" },
};

function subline(h: HabitWithStatus): string {
  const { habit, status } = h;
  if (habit.cadence_kind === "daily") {
    return status.done_today ? "Today · done" : "Today";
  }
  if (habit.cadence_kind === "weekly") {
    const c = status.period_count ?? 0;
    const t = status.period_target ?? habit.weekly_target ?? 1;
    return `${c}/${t} this week · ends Sun`;
  }
  // interval
  const every = habit.interval_days ?? 0;
  const dsl = status.days_since_last;
  if (dsl == null) return `Every ${every}d · never done`;
  const dud = status.days_until_due ?? 0;
  const due =
    dud > 1
      ? `Due in ${dud}d`
      : dud === 1
        ? "Due tomorrow"
        : dud === 0
          ? "Due today"
          : `Overdue ${-dud}d`;
  return `Every ${every}d · last ${dsl}d ago · ${due}`;
}

export function HabitRow({ item }: { item: HabitWithStatus }) {
  const toggle = useToggleHabit();
  const pill: Pill = STATUS_PILL[item.status.status] ?? OK_PILL;
  const done = item.status.done_today;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        border: "1px solid #1e293b",
        borderRadius: 10,
        background: "rgba(15, 23, 42, 0.4)",
      }}
    >
      <button
        type="button"
        onClick={() => toggle.mutate(item.habit.id)}
        disabled={toggle.isPending}
        aria-label={done ? "Mark not done" : "Mark done"}
        style={{
          flex: "0 0 auto",
          width: 44,
          height: 44,
          borderRadius: 22,
          border: done ? "0" : "2px solid #475569",
          background: done ? "#10b981" : "transparent",
          color: done ? "#0b1220" : "#cbd5e1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {done ? "✓" : ""}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#cbd5e1", lineHeight: 0 }}>
            <PresetIcon preset={{ icon_kind: item.habit.icon_kind, icon_key: item.habit.icon_key }} size={20} />
          </span>
          <span style={{ fontWeight: 600 }}>{item.habit.name}</span>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{subline(item)}</div>
      </div>
      <span
        style={{
          flex: "0 0 auto",
          padding: "4px 10px",
          borderRadius: 9999,
          background: pill.bg,
          color: pill.fg,
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        {pill.label}
        {item.status.streak > 1 ? ` · ${item.status.streak}🔥` : ""}
      </span>
    </div>
  );
}
