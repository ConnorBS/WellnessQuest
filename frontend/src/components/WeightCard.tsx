"use client";

import Link from "next/link";
import { useState } from "react";

import { Modal } from "@/components/Modal";
import { WeightForm } from "@/components/weight/WeightForm";
import { WeightSparkline } from "@/components/weight/WeightSparkline";
import { quickLogBtn } from "@/components/quickLogButton";
import { useMe } from "@/hooks/useMe";
import { useWeightHistory, useWeightSummary, useWeightTrend } from "@/hooks/useWeight";
import { formatTrendDelta, formatWeight, formatWeightDelta } from "@/lib/units";

export function WeightCard({ showQuickLog = false }: { showQuickLog?: boolean }) {
  const { data: me } = useMe();
  const summary = useWeightSummary();
  const history = useWeightHistory(30);
  const trend = useWeightTrend(90);
  const [showLog, setShowLog] = useState(false);
  const unit = me?.weight_unit ?? "kg";
  const showRawDelta = me?.show_raw_weight_delta ?? false;

  const latest = summary.data?.latest;
  const rawDelta = summary.data?.delta_kg ?? null;
  const trendKg = summary.data?.trend_kg ?? null;
  const trendDelta = summary.data?.trend_delta_kg ?? null;
  const trendReady = summary.data?.trend_ready ?? false;
  const lookbackDays = summary.data?.trend_lookback_days ?? 14;
  const target = summary.data?.current_target?.target_kg ?? null;
  const startingKg = summary.data?.starting_kg ?? null;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <h2 className="text-lg font-semibold">Weight</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {showQuickLog && (
            <button
              type="button"
              onClick={() => setShowLog(true)}
              data-testid="dashboard-log-weight"
              style={quickLogBtn}
            >
              + Log
            </button>
          )}
          <Link href="/weight" style={{ fontSize: 13, color: "#10b981" }}>
            See all →
          </Link>
        </div>
      </header>
      {summary.isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : !latest ? (
        <p className="mt-3 text-sm text-slate-400">
          No entries yet — <Link href="/weight" style={{ color: "#10b981" }}>log your first</Link>.
        </p>
      ) : (
        <>
          {trendReady && trendKg != null ? (
            <TrendHeadline
              trendKg={trendKg}
              trendDelta={trendDelta}
              lookbackDays={lookbackDays}
              latestKg={latest.weight_kg}
              latestAt={latest.occurred_at}
              rawDelta={rawDelta}
              showRawDelta={showRawDelta}
              unit={unit}
            />
          ) : (
            <ColdStartHeadline
              latestKg={latest.weight_kg}
              latestAt={latest.occurred_at}
              unit={unit}
            />
          )}
          <TargetLine
            target={target}
            startingKg={startingKg}
            currentKg={trendReady && trendKg != null ? trendKg : latest.weight_kg}
            unit={unit}
          />
          {history.data && history.data.length >= 2 && (
            <div style={{ marginTop: 10 }}>
              <WeightSparkline
                entries={history.data}
                unit={unit}
                height={72}
                trend={trend.data?.points ?? null}
              />
            </div>
          )}
        </>
      )}
      {showQuickLog && showLog ? (
        <Modal title="Log weight" onClose={() => setShowLog(false)}>
          <WeightForm unit={unit} onSaved={() => setShowLog(false)} />
        </Modal>
      ) : null}
    </section>
  );
}

function TrendHeadline({
  trendKg,
  trendDelta,
  lookbackDays,
  latestKg,
  latestAt,
  rawDelta,
  showRawDelta,
  unit,
}: {
  trendKg: number;
  trendDelta: number | null;
  lookbackDays: number;
  latestKg: number;
  latestAt: string;
  rawDelta: number | null;
  showRawDelta: boolean;
  unit: string;
}) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 700 }}>
          {formatWeight(trendKg, unit)}
        </span>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>trend</span>
      </div>
      {trendDelta != null && (
        <p style={{ color: "#cbd5e1", fontSize: 13, marginTop: 2 }}>
          {formatTrendDelta(trendDelta, unit, lookbackDays)}
        </p>
      )}
      <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
        Last logged: {formatWeight(latestKg, unit)} ·{" "}
        {new Date(latestAt).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </p>
      {showRawDelta && rawDelta != null && (
        <p style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
          Reading-to-reading: {formatWeightDelta(rawDelta, unit)}
        </p>
      )}
    </>
  );
}

function ColdStartHeadline({
  latestKg,
  latestAt,
  unit,
}: {
  latestKg: number;
  latestAt: string;
  unit: string;
}) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 700 }}>
          {formatWeight(latestKg, unit)}
        </span>
      </div>
      <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
        {new Date(latestAt).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </p>
      <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>
        Log a few more readings over the next week or two and we&apos;ll show
        your trend here. Day-to-day numbers fluctuate too much to be a useful
        signal on their own.
      </p>
    </>
  );
}

function TargetLine({
  target,
  startingKg,
  currentKg,
  unit,
}: {
  target: number | null;
  startingKg: number | null;
  currentKg: number;
  unit: string;
}) {
  if (target == null) return null;
  const atTarget = Math.abs(currentKg - target) < 0.05;

  // Progress framing when we know where the user started. We render a thin
  // bar from start -> target instead of a "down N lb to go" countdown.
  if (!atTarget && startingKg != null && startingKg !== target) {
    const total = startingKg - target; // signed: positive if losing toward a lower target
    const moved = startingKg - currentKg;
    const pct = total === 0 ? 0 : Math.max(0, Math.min(100, (moved / total) * 100));
    return (
      <div style={{ marginTop: 8 }}>
        <p style={{ color: "#cbd5e1", fontSize: 13 }}>
          Target: {formatWeight(target, unit)} ·{" "}
          <span style={{ color: "#94a3b8" }}>{pct.toFixed(0)}% from start</span>
        </p>
        <div
          aria-hidden
          style={{
            marginTop: 6,
            height: 4,
            borderRadius: 2,
            background: "#1e293b",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "#10b981",
              opacity: 0.7,
            }}
          />
        </div>
      </div>
    );
  }

  if (atTarget) {
    return (
      <p style={{ color: "#cbd5e1", fontSize: 13, marginTop: 8 }}>
        Target: {formatWeight(target, unit)} ·{" "}
        <span style={{ color: "#6ee7b7" }}>at target</span>
      </p>
    );
  }

  // No starting point yet — show the target weight neutrally, no deficit.
  // Suppress kg display value comparison entirely; users can see it on /weight.
  return (
    <p style={{ color: "#cbd5e1", fontSize: 13, marginTop: 8 }}>
      Target: {formatWeight(target, unit)}
    </p>
  );
}

