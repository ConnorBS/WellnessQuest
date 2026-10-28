"use client";

import Link from "next/link";

import { HabitRow } from "@/components/habits/HabitRow";
import { useHabits } from "@/hooks/useHabits";

export function HabitsCard() {
  const { data, isLoading } = useHabits();

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Habits</h2>
        <Link href="/habits" style={{ fontSize: 13, color: "var(--wq-accent)" }}>
          See all →
        </Link>
      </header>
      {isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          No habits yet — <Link href="/settings/habits" style={{ color: "var(--wq-accent)" }}>add some in settings</Link>.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {data
            .slice()
            .sort((a, b) => statusRank(a.status.status) - statusRank(b.status.status))
            .slice(0, 5)
            .map((item) => (
              <li key={item.habit.id}>
                <HabitRow item={item} />
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

function statusRank(s: string): number {
  switch (s) {
    case "overdue":
      return 0;
    case "due_today":
      return 1;
    case "ok":
      return 2;
    case "done":
      return 3;
    default:
      return 4;
  }
}
