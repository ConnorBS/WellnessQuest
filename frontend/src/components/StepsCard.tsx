"use client";

import Link from "next/link";
import { useState } from "react";

import { StepsLogModal } from "@/components/steps/StepsLogModal";
import { useDeleteSteps } from "@/hooks/useAddSteps";
import { useStepsToday } from "@/hooks/useStepsToday";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StepsCard() {
  const { data, isLoading } = useStepsToday();
  const del = useDeleteSteps();
  const [logOpen, setLogOpen] = useState(false);

  const total = data?.total ?? 0;
  const goal = data?.goal ?? 8000;
  const entries = data?.entries ?? [];
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

      {entries.length > 0 && (
        <ul style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {entries.map((e) => (
            <li
              key={e.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 13,
                color: "#cbd5e1",
              }}
            >
              <span>
                {e.count.toLocaleString()} steps
                <span style={{ color: "#64748b" }}>
                  {" · "}
                  {formatTime(e.occurred_at)} · {e.source}
                </span>
              </span>
              {e.id > 0 && (
                <button
                  type="button"
                  onClick={() => del.mutate(e.id)}
                  aria-label={`Delete ${e.count} steps`}
                  style={{
                    background: "transparent",
                    color: "#94a3b8",
                    border: "none",
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {total === 0 && !isLoading && (
        <p className="mt-3 text-sm text-slate-400">
          No steps yet today — log them above, or connect{" "}
          <Link href="/settings/integrations" style={{ color: "#10b981" }}>
            Home Assistant
          </Link>{" "}
          to import from your phone or wearable.
        </p>
      )}
      {isLoading && <p className="mt-3 text-sm text-slate-400">Loading...</p>}

      {logOpen && <StepsLogModal onClose={() => setLogOpen(false)} />}
    </section>
  );
}
