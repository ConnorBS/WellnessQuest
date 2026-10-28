"use client";

import Link from "next/link";

import { usePeriodHistory } from "@/hooks/usePeriod";
import { computeCycleStats } from "@/lib/cycle";

export function PeriodCard() {
  const history = usePeriodHistory(365);
  const entries = history.data ?? [];
  const stats = computeCycleStats(entries);

  let body: React.ReactNode;
  if (history.isLoading) {
    body = <p className="mt-3 text-sm text-slate-400">Loading…</p>;
  } else if (entries.length === 0) {
    body = (
      <p className="mt-3 text-sm text-slate-400">
        No period days logged yet —{" "}
        <Link href="/period" style={{ color: "var(--wq-accent)" }}>
          open the calendar
        </Link>
        .
      </p>
    );
  } else if (stats.isOnPeriodToday) {
    body = (
      <p style={{ fontSize: 16, fontWeight: 600, marginTop: 6, color: "#fb7185" }}>
        On your period today
      </p>
    );
  } else if (stats.daysUntilNext != null) {
    const d = stats.daysUntilNext;
    body = (
      <div style={{ marginTop: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 700 }}>
          {d <= 0 ? "Due now" : `${d} day${d === 1 ? "" : "s"}`}
        </span>
        <span style={{ color: "var(--wq-muted)", fontSize: 13 }}>
          {d <= 0 ? " · next period predicted" : " until next period"}
        </span>
      </div>
    );
  } else {
    body = (
      <p className="mt-3 text-sm text-slate-400">
        Log a couple of cycles to see predictions.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <h2 className="text-lg font-semibold">Period</h2>
        <Link href="/period" style={{ fontSize: 13, color: "var(--wq-accent)" }}>
          See all →
        </Link>
      </header>
      {body}
    </section>
  );
}
