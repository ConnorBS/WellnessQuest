"use client";

import type { WeightEntry, WeightTrendPoint } from "@/lib/schemas";
import { kgToDisplay } from "@/lib/units";

interface Props {
  entries: WeightEntry[]; // assumed sorted desc by occurred_at (newest first)
  unit: string;
  width?: number;
  height?: number;
  // Optional trend series (oldest -> newest). When supplied, the chart
  // renders the smoothed trend as the hero line and the raw entries as
  // faint dots. Without it the chart falls back to the raw-only line so
  // existing callers don't break.
  trend?: WeightTrendPoint[] | null;
}

export function WeightSparkline({
  entries,
  unit,
  width = 320,
  height = 96,
  trend = null,
}: Props) {
  if (entries.length < 2) return null;

  const rawOldestFirst = entries.slice().reverse();
  const trendPoints = trend && trend.length >= 2 ? trend : null;

  // Y-axis spans everything we're going to draw so neither layer clips.
  const allValues: number[] = [
    ...rawOldestFirst.map((e) => kgToDisplay(e.weight_kg, unit)),
  ];
  if (trendPoints) {
    for (const p of trendPoints) allValues.push(kgToDisplay(p.trend_kg, unit));
  }
  const yMin = Math.min(...allValues);
  const yMax = Math.max(...allValues);
  const yRange = Math.max(0.5, yMax - yMin);

  const padX = 4;
  const padY = 8;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  // X-axis is time-anchored when we have a trend series; otherwise it falls
  // back to evenly-spaced indices (original behavior). The `entries.length < 2`
  // guard above ensures rawOldestFirst has ≥2 elements here.
  const firstRaw = rawOldestFirst[0]!;
  const lastRaw = rawOldestFirst[rawOldestFirst.length - 1]!;
  const firstTrend = trendPoints?.[0];
  const lastTrend = trendPoints?.[trendPoints.length - 1];
  const tMin = trendPoints && firstTrend
    ? Math.min(
        new Date(firstRaw.occurred_at).getTime(),
        new Date(firstTrend.occurred_at).getTime(),
      )
    : 0;
  const tMax = trendPoints && lastTrend
    ? Math.max(
        new Date(lastRaw.occurred_at).getTime(),
        new Date(lastTrend.occurred_at).getTime(),
      )
    : 0;
  const tRange = Math.max(1, tMax - tMin);

  function projectX(idx: number, total: number, occurredAt?: string): number {
    if (trendPoints && occurredAt) {
      const t = new Date(occurredAt).getTime();
      return padX + ((t - tMin) / tRange) * innerW;
    }
    if (total === 1) return padX + innerW / 2;
    return padX + (idx / (total - 1)) * innerW;
  }

  function projectY(displayValue: number): number {
    return padY + (1 - (displayValue - yMin) / yRange) * innerH;
  }

  const rawPoints = rawOldestFirst.map((e, i) => ({
    x: projectX(i, rawOldestFirst.length, e.occurred_at),
    y: projectY(kgToDisplay(e.weight_kg, unit)),
  }));

  const trendXY = trendPoints?.map((p, i) => ({
    x: projectX(i, trendPoints.length, p.occurred_at),
    y: projectY(kgToDisplay(p.trend_kg, unit)),
  }));

  // When we have a trend, that's the hero path. Otherwise draw the raw
  // entries as the line (legacy behavior).
  const heroPoints = trendXY ?? rawPoints;
  const heroPath = heroPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const last = heroPoints[heroPoints.length - 1];

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {/* Hero line: smoothed trend if we have it, raw entries otherwise. */}
      <path
        d={heroPath}
        stroke="var(--wq-accent)"
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Raw scatter — faint when trend is the hero, prominent otherwise. */}
      {rawPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={1.5}
          fill="var(--wq-accent)"
          opacity={trendPoints ? 0.35 : 1}
        />
      ))}
      {last && <circle cx={last.x} cy={last.y} r={3} fill="var(--wq-accent)" />}
    </svg>
  );
}
