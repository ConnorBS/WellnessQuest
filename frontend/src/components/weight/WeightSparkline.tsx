"use client";

import type { WeightEntry } from "@/lib/schemas";
import { kgToDisplay } from "@/lib/units";

interface Props {
  entries: WeightEntry[]; // assumed sorted desc by occurred_at (newest first)
  unit: string;
  width?: number;
  height?: number;
}

export function WeightSparkline({ entries, unit, width = 320, height = 96 }: Props) {
  if (entries.length < 2) return null;

  const sorted = entries.slice().reverse(); // oldest -> newest for left-to-right
  const ys = sorted.map((e) => kgToDisplay(e.weight_kg, unit));
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yRange = Math.max(0.5, yMax - yMin); // avoid div-by-zero on flat series

  const padX = 4;
  const padY = 8;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = sorted.map((e, i) => {
    const x = padX + (sorted.length === 1 ? innerW / 2 : (i / (sorted.length - 1)) * innerW);
    const yVal = kgToDisplay(e.weight_kg, unit);
    const y = padY + (1 - (yVal - yMin) / yRange) * innerH;
    return { x, y };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={path} stroke="#10b981" strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.5} fill="#10b981" />
      ))}
      {last && <circle cx={last.x} cy={last.y} r={3} fill="#10b981" />}
    </svg>
  );
}
