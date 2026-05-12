"use client";

import Link from "next/link";

import { useFoodPresets } from "@/hooks/useFoodPresets";
import { useFoodToday } from "@/hooks/useFoodToday";
import { QuickAddFoodButton } from "@/components/QuickAddFoodButton";

export function FoodCard() {
  const { data, isLoading } = useFoodToday();
  const presets = useFoodPresets();
  const total = data?.total_kcal ?? 0;
  const target = data?.target_kcal ?? 2000;
  const remaining = target - total;
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const over = data?.over_target ?? false;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Food</h2>
        <span data-testid="food-total" className="text-slate-300">
          {total} / {target} kcal
        </span>
      </header>
      <div
        className="my-4 h-3 w-full overflow-hidden rounded-full bg-slate-800"
        aria-label="progress"
      >
        <div
          className={`h-full transition-all ${over ? "bg-rose-500" : "bg-amber-400"}`}
          style={{ width: `${pct}%` }}
          data-testid="food-progress"
        />
      </div>
      <p
        className="text-sm"
        style={{ color: over ? "#fb7185" : "#94a3b8", marginBottom: 8 }}
      >
        {over
          ? `Over by ${total - target} kcal`
          : `${remaining} kcal remaining today`}
      </p>
      {presets.data && presets.data.length > 0 ? (
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(presets.data.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {presets.data.map((p) => (
            <QuickAddFoodButton key={p.id} preset={p} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          No quick foods yet —{" "}
          <Link href="/settings/food" style={{ color: "#10b981" }}>
            add some in settings
          </Link>
          .
        </p>
      )}
      {isLoading && <p className="mt-3 text-sm text-slate-400">Loading...</p>}
    </section>
  );
}
