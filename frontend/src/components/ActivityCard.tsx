"use client";

import Link from "next/link";

import { useActivityPresets } from "@/hooks/useActivityPresets";
import { useActivityToday } from "@/hooks/useActivityToday";
import { CustomAddActivity } from "@/components/CustomAddActivity";
import { QuickAddActivityButton } from "@/components/QuickAddActivityButton";

export function ActivityCard() {
  const { data, isLoading } = useActivityToday();
  const presets = useActivityPresets();
  const total = data?.total_minutes ?? 0;
  const goal = data?.goal_minutes ?? 30;
  const pct = goal ? Math.min(100, Math.round((total / goal) * 100)) : 0;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Activity</h2>
        <span data-testid="activity-total" className="text-slate-300">
          {total} / {goal} min
        </span>
      </header>
      <div className="my-4 h-3 w-full overflow-hidden rounded-full bg-slate-800" aria-label="progress">
        <div
          className="h-full bg-sky-500 transition-all"
          style={{ width: `${pct}%` }}
          data-testid="activity-progress"
        />
      </div>
      {presets.data && presets.data.length > 0 ? (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(presets.data.length, 4)}, minmax(0, 1fr))` }}
        >
          {presets.data.map((p) => (
            <QuickAddActivityButton key={p.id} preset={p} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          No quick-add buttons yet — <Link href="/settings/activity" style={{ color: "#10b981" }}>add some in settings</Link>.
        </p>
      )}
      <CustomAddActivity />
      {isLoading && <p className="mt-3 text-sm text-slate-400">Loading...</p>}
    </section>
  );
}
