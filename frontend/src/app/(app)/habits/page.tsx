"use client";

import Link from "next/link";

import { HabitRow } from "@/components/habits/HabitRow";
import { useHabits } from "@/hooks/useHabits";

export default function HabitsPage() {
  const { data, isLoading } = useHabits();

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header className="flex items-baseline justify-between" style={{ marginBottom: 12 }}>
          <h2 className="text-lg font-semibold">Habits</h2>
          <Link href="/settings/habits" style={{ fontSize: 13, color: "#10b981" }}>
            Manage →
          </Link>
        </header>
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-slate-400">
            No habits yet — <Link href="/settings/habits" style={{ color: "#10b981" }}>add some in settings</Link>.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {data.map((item) => (
              <li key={item.habit.id}>
                <HabitRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
