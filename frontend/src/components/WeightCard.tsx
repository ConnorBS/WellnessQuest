"use client";

import Link from "next/link";

import { WeightSparkline } from "@/components/weight/WeightSparkline";
import { useMe } from "@/hooks/useMe";
import { useWeightHistory, useWeightSummary } from "@/hooks/useWeight";
import { formatWeight, formatWeightDelta } from "@/lib/units";

export function WeightCard() {
  const { data: me } = useMe();
  const summary = useWeightSummary();
  const history = useWeightHistory(30);
  const unit = me?.weight_unit ?? "kg";
  const latest = summary.data?.latest;
  const delta = summary.data?.delta_kg;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Weight</h2>
        <Link href="/weight" style={{ fontSize: 13, color: "#10b981" }}>
          See all →
        </Link>
      </header>
      {summary.isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : !latest ? (
        <p className="mt-3 text-sm text-slate-400">
          No entries yet — <Link href="/weight" style={{ color: "#10b981" }}>log your first</Link>.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700 }}>
              {formatWeight(latest.weight_kg, unit)}
            </span>
            {delta != null && (
              <span style={{ color: deltaColor(delta), fontSize: 13 }}>
                {formatWeightDelta(delta, unit)} vs last
              </span>
            )}
          </div>
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
            {new Date(latest.occurred_at).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
          {history.data && history.data.length >= 2 && (
            <div style={{ marginTop: 10 }}>
              <WeightSparkline entries={history.data} unit={unit} height={72} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function deltaColor(delta: number): string {
  if (delta === 0) return "#94a3b8";
  // Neutral coloring — direction isn't inherently good/bad. Use slate so the
  // card doesn't moralize over weight changes.
  return "#cbd5e1";
}
