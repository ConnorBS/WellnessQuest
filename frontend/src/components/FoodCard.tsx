"use client";

import Link from "next/link";

import { useDailyValues } from "@/hooks/useDailyValues";
import { useFoodPresets } from "@/hooks/useFoodPresets";
import { useFoodToday } from "@/hooks/useFoodToday";
import { useRecentFood } from "@/hooks/useRecentFood";
import { KEY_NUTRIENTS, dvBarColor } from "@/lib/canadianDV";
import { QuickAddFoodButton } from "@/components/QuickAddFoodButton";
import { QuickAddRecentButton } from "@/components/QuickAddRecentButton";

export function FoodCard() {
  const { data, isLoading } = useFoodToday();
  const { data: dv } = useDailyValues();
  const presets = useFoodPresets();
  const recent = useRecentFood(6);
  const total = data?.total_kcal ?? 0;
  const target = data?.target_kcal ?? 2000;
  const remaining = target - total;
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const over = data?.over_target ?? false;

  // Hide recents that the user has already pinned as a preset (same name +
  // brand). Avoids duplicate buttons for the same food on the card.
  const presetKeys = new Set(
    (presets.data ?? []).map(
      (p) => `${p.label.trim().toLowerCase()}|${(p.brand ?? "").trim().toLowerCase()}`,
    ),
  );
  const recentToShow = (recent.data ?? []).filter(
    (r) =>
      !presetKeys.has(
        `${r.name.trim().toLowerCase()}|${(r.brand ?? "").trim().toLowerCase()}`,
      ),
  );

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Food</h2>
        <span data-testid="food-total" className="text-slate-300">
          {total} / {target} kcal
        </span>
      </header>
      <div
        className="my-4 h-3 w-full overflow-hidden rounded-full bg-slate-800"
        aria-label="progress"
      >
        <div
          className={`h-full transition-all ${over ? "bg-rose-500" : "bg-amber-400"}`}
          style={{ width: `${pct}%` }}
          data-testid="food-progress"
        />
      </div>
      <p
        className="text-sm"
        style={{ color: over ? "#fb7185" : "#94a3b8", marginBottom: 8 }}
      >
        {over
          ? `Over by ${total - target} kcal`
          : `${remaining} kcal remaining today`}
      </p>
      {data ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 12,
          }}
          aria-label="Key Daily Value chips"
        >
          {KEY_NUTRIENTS.map((key) => {
            const meta = dv.meta[key];
            const pctV = data.dv_percent[key] ?? 0;
            if (!meta) return null;
            const color = dvBarColor(meta.kind, pctV);
            return (
              <span
                key={key}
                title={`${meta.label} — ${Math.round(pctV)}% of DV`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#0b1220",
                  border: "1px solid #1e293b",
                  borderRadius: 999,
                  padding: "2px 10px",
                  fontSize: 11,
                  color: "#cbd5e1",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: color,
                  }}
                />
                {meta.label} · {Math.round(pctV)}%
              </span>
            );
          })}
        </div>
      ) : null}
      {presets.data && presets.data.length > 0 ? (
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(presets.data.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {presets.data.map((p) => (
            <QuickAddFoodButton key={p.id} preset={p} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          No quick foods yet —{" "}
          <Link href="/settings/food" style={{ color: "#10b981" }}>
            add some in settings
          </Link>
          .
        </p>
      )}
      {recentToShow.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p
            style={{
              fontSize: 11,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Recent
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {recentToShow.map((r) => (
              <QuickAddRecentButton key={`${r.name}-${r.last_logged_at}`} entry={r} />
            ))}
          </div>
        </div>
      )}
      {isLoading && <p className="mt-3 text-sm text-slate-400">Loading...</p>}
    </section>
  );
}
