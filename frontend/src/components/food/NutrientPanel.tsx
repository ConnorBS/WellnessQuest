"use client";

import { dvBarColor, PANEL_ORDER } from "@/lib/canadianDV";
import { useDailyValues } from "@/hooks/useDailyValues";

interface Props {
  /**
   * Nutrient amounts to display. Keys correspond to `NutrientPanel` schema
   * keys; plus `kcal`, `protein_g`, `carbs_g`, `fat_g` for the macro rows
   * the dashboard total uses. Missing keys render as a dash.
   */
  totals: Record<string, number | null | undefined>;
  /**
   * Pre-computed % DV per nutrient, when available (e.g. from
   * `/food/today.dv_percent`). When omitted, we compute it client-side from
   * the totals + the cached DV table.
   */
  dvPercent?: Record<string, number>;
  /** Show all 29 rows vs the abbreviated mandatory-row subset. */
  compact?: boolean;
}

export function NutrientPanel({ totals, dvPercent, compact }: Props) {
  const { data: dv } = useDailyValues();

  const keys = compact ? COMPACT_KEYS : PANEL_ORDER;

  return (
    <div
      style={{
        border: "1px solid #1e293b",
        borderRadius: 6,
        background: "#0b1220",
        padding: 12,
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto 56px",
          gap: 6,
          alignItems: "center",
        }}
      >
        <span style={{ color: "#64748b", fontWeight: 600 }}>Nutrient</span>
        <span style={{ color: "#64748b", fontWeight: 600, textAlign: "right" }}>
          Amount
        </span>
        <span style={{ color: "#64748b", fontWeight: 600, textAlign: "right" }}>
          % DV
        </span>
        {keys.map((key) => {
          const meta = dv.meta[key];
          if (!meta) return null;
          const amount = totals[key];
          const pct = dvPercent?.[key] ?? computePct(dv.values[key], amount);
          const color = dvBarColor(meta.kind, pct);
          return (
            <PanelRow
              key={key}
              label={meta.label}
              unit={meta.unit}
              amount={amount}
              pct={pct}
              color={color}
              hasDv={!!dv.values[key]}
            />
          );
        })}
      </div>
      <p style={{ marginTop: 8, marginBottom: 0, fontSize: 11, color: "#64748b" }}>
        % Daily Value reflects Health Canada Schedule K. Foods labelled 5% or less
        are <em>a little</em>; 15% or more are <em>a lot</em>.
      </p>
    </div>
  );
}

const COMPACT_KEYS = [
  "kcal",
  "fat_g",
  "saturated_trans_g",
  "carbs_g",
  "fibre_g",
  "sugars_g",
  "protein_g",
  "cholesterol_mg",
  "sodium_mg",
];

function computePct(dv: number | undefined, amount: number | null | undefined): number {
  if (!dv || dv <= 0 || amount == null) return 0;
  return Math.round((amount / dv) * 1000) / 10;
}

function PanelRow({
  label,
  unit,
  amount,
  pct,
  color,
  hasDv,
}: {
  label: string;
  unit: string;
  amount: number | null | undefined;
  pct: number;
  color: string;
  hasDv: boolean;
}) {
  return (
    <>
      <span style={{ color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      <span
        style={{
          color: amount == null ? "#475569" : "#e2e8f0",
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {amount == null ? "—" : `${formatAmount(amount)} ${unit}`}
      </span>
      <span
        style={{
          textAlign: "right",
          color,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
        aria-label={hasDv ? `${pct} percent of daily value` : "no daily value"}
      >
        {hasDv ? `${Math.round(pct)}%` : "—"}
      </span>
    </>
  );
}

function formatAmount(v: number): string {
  if (v === 0) return "0";
  if (v < 1) return v.toFixed(2).replace(/\.?0+$/, "");
  if (v < 10) return v.toFixed(1).replace(/\.0$/, "");
  return String(Math.round(v));
}
