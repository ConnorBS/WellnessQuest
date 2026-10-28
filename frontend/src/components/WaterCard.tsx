"use client";

import Link from "next/link";
import { useState } from "react";

import { useWaterPresets } from "@/hooks/useWaterPresets";
import { useWaterToday } from "@/hooks/useWaterToday";
import { CustomAddWater } from "@/components/CustomAddWater";
import { QuickAddWaterButton } from "@/components/QuickAddWaterButton";
import { WaterLogModal } from "@/components/water/WaterLogModal";
import { quickLogBtn } from "@/components/quickLogButton";

export function WaterCard({ showQuickLog = false }: { showQuickLog?: boolean }) {
  const { data, isLoading } = useWaterToday();
  const presets = useWaterPresets();
  const [showLog, setShowLog] = useState(false);
  const total = data?.total_ml ?? 0;
  const goal = data?.goal_ml ?? 2000;
  const pct = goal ? Math.min(100, Math.round((total / goal) * 100)) : 0;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <h2 className="text-lg font-semibold">Water</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span data-testid="water-total" className="text-slate-300">
            {total} / {goal} ml
          </span>
          {showQuickLog && (
            <button
              type="button"
              onClick={() => setShowLog(true)}
              data-testid="dashboard-log-water"
              style={quickLogBtn}
            >
              + Log
            </button>
          )}
        </div>
      </header>
      <div className="my-4 h-3 w-full overflow-hidden rounded-full bg-slate-800" aria-label="progress">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
          data-testid="water-progress"
        />
      </div>
      {presets.data && presets.data.length > 0 ? (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(presets.data.length, 4)}, minmax(0, 1fr))` }}
        >
          {presets.data.map((p) => (
            <QuickAddWaterButton key={p.id} preset={p} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          No quick-add buttons yet — <Link href="/settings/water" style={{ color: "var(--wq-accent)" }}>add some in settings</Link>.
        </p>
      )}
      <CustomAddWater />
      {isLoading && <p className="mt-3 text-sm text-slate-400">Loading...</p>}
      {showQuickLog && showLog ? <WaterLogModal onClose={() => setShowLog(false)} /> : null}
    </section>
  );
}
