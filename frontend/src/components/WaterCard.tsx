"use client";

import { useWaterToday } from "@/hooks/useWaterToday";
import { QuickAddWaterButton } from "@/components/QuickAddWaterButton";

export function WaterCard() {
  const { data, isLoading } = useWaterToday();
  const total = data?.total_ml ?? 0;
  const goal = data?.goal_ml ?? 2000;
  const pct = goal ? Math.min(100, Math.round((total / goal) * 100)) : 0;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Water</h2>
        <span data-testid="water-total" className="text-slate-300">
          {total} / {goal} ml
        </span>
      </header>
      <div className="my-4 h-3 w-full overflow-hidden rounded-full bg-slate-800" aria-label="progress">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
          data-testid="water-progress"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <QuickAddWaterButton ml={250} />
        <QuickAddWaterButton ml={500} />
        <QuickAddWaterButton ml={750} />
      </div>
      {isLoading && <p className="mt-3 text-sm text-slate-400">Loading...</p>}
    </section>
  );
}
