"use client";

import Link from "next/link";
import { useState } from "react";

import { StepsLogModal } from "@/components/steps/StepsLogModal";
import { useStepsToday } from "@/hooks/useStepsToday";

export function StepsCard({ showQuickLog = false }: { showQuickLog?: boolean }) {
  const { data, isLoading } = useStepsToday();
  const [logOpen, setLogOpen] = useState(false);

  const total = data?.total ?? 0;
  const goal = data?.goal ?? 8000;
  const pct = goal ? Math.min(100, Math.round((total / goal) * 100)) : 0;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Steps</h2>
        <span data-testid="steps-total" className="text-slate-300">
          {total.toLocaleString()} / {goal.toLocaleString()}
        </span>
      </header>
      <div
        className="my-4 h-3 w-full overflow-hidden rounded-full bg-slate-800"
        aria-label="progress"
      >
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${pct}%` }}
          data-testid="steps-progress"
        />
      </div>

      {/* The Steps page has its own log button in the entry-list header, so the
          card only offers one on the dashboard. */}
      {showQuickLog && (
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          data-testid="steps-log-open"
          style={{
            padding: "8px 12px",
            background: "#1e293b",
            color: "#e2e8f0",
            border: "1px solid #334155",
            borderRadius: 6,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          + Log steps
        </button>
      )}

      {total === 0 && !isLoading && (
        <p className="mt-3 text-sm text-slate-400">
          No steps yet today — log some, or connect{" "}
          <Link href="/settings/integrations" style={{ color: "#10b981" }}>
            Home Assistant
          </Link>{" "}
          to import from your phone or wearable.
        </p>
      )}
      {isLoading && <p className="mt-3 text-sm text-slate-400">Loading...</p>}

      {showQuickLog && logOpen && <StepsLogModal onClose={() => setLogOpen(false)} />}
    </section>
  );
}
