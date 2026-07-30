"use client";

import Link from "next/link";
import { useState } from "react";

import { SleepLogModal } from "@/components/sleep/SleepLogModal";
import { useDeleteSleep } from "@/hooks/useAddSleep";
import { useSleepLast } from "@/hooks/useSleepLast";
import { formatDuration } from "@/lib/duration";

function formatEnded(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SleepCard({ showQuickLog = false }: { showQuickLog?: boolean }) {
  const { data, isLoading } = useSleepLast();
  const del = useDeleteSleep();
  const [logOpen, setLogOpen] = useState(false);

  const entry = data?.entry ?? null;
  const goalMin = data?.goal_minutes ?? 420;
  const durMin = entry?.duration_minutes ?? 0;
  const pct = goalMin ? Math.min(100, Math.round((durMin / goalMin) * 100)) : 0;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Sleep</h2>
        <span data-testid="sleep-duration" className="text-slate-300">
          {entry ? formatDuration(durMin) : "—"} / {formatDuration(goalMin)}
        </span>
      </header>
      <div
        className="my-4 h-3 w-full overflow-hidden rounded-full bg-slate-800"
        aria-label="progress"
      >
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${pct}%` }}
          data-testid="sleep-progress"
        />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {/* The Sleep page has its own log button in the history header, so the
            card only offers one on the dashboard. */}
        {showQuickLog && (
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            data-testid="sleep-log-open"
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
            + Log sleep
          </button>
        )}
        {showQuickLog && entry && entry.source === "pwa" && (
          <button
            type="button"
            onClick={() => del.mutate(entry.id)}
            data-testid="sleep-delete"
            style={{
              padding: "8px 12px",
              background: "transparent",
              color: "#fca5a5",
              border: "1px solid #7f1d1d",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        )}
      </div>

      {entry ? (
        <p className="mt-3 text-sm text-slate-400">
          Last session ended {formatEnded(entry.ended_at)}
          {entry.quality_score != null && ` · quality ${entry.quality_score}/100`}
          {` · ${entry.source}`}
        </p>
      ) : (
        !isLoading && (
          <p className="mt-3 text-sm text-slate-400">
            No sleep data yet — log a night, or connect{" "}
            <Link href="/settings/integrations" style={{ color: "#10b981" }}>
              Home Assistant
            </Link>{" "}
            to import from your CPAP or wearable.
          </p>
        )
      )}
      {isLoading && <p className="mt-3 text-sm text-slate-400">Loading...</p>}

      {showQuickLog && logOpen && <SleepLogModal onClose={() => setLogOpen(false)} />}
    </section>
  );
}
