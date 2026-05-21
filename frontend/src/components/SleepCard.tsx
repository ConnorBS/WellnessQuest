"use client";

import Link from "next/link";

import { useSleepLast } from "@/hooks/useSleepLast";

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatEnded(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SleepCard() {
  const { data, isLoading } = useSleepLast();
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
      {entry ? (
        <p className="text-sm text-slate-400">
          Last session ended {formatEnded(entry.ended_at)}
          {entry.quality_score != null && ` · quality ${entry.quality_score}/100`}
        </p>
      ) : (
        !isLoading && (
          <p className="text-sm text-slate-400">
            No sleep data yet — connect{" "}
            <Link href="/settings/integrations" style={{ color: "#10b981" }}>
              Home Assistant
            </Link>{" "}
            to import from your CPAP or wearable.
          </p>
        )
      )}
      {isLoading && <p className="mt-3 text-sm text-slate-400">Loading...</p>}
    </section>
  );
}
