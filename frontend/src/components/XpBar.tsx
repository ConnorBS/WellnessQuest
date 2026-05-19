"use client";

import { useMe } from "@/hooks/useMe";

function thresholdFor(level: number): number {
  // Mirrors backend: cumulative XP for level n = 100 * n * (n - 1) / 2
  return (100 * level * (level - 1)) / 2;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#94a3b8",
  uncommon: "#4ade80",
  rare: "#60a5fa",
  epic: "#c084fc",
  legendary: "#fbbf24",
};

export function XpBar() {
  const { data } = useMe();
  if (!data) return null;
  const current = data.xp_total;
  const lower = thresholdFor(data.level);
  const upper = thresholdFor(data.level + 1);
  const span = Math.max(1, upper - lower);
  const pct = Math.min(100, Math.round(((current - lower) / span) * 100));
  const title = !data.title_hidden ? data.equipped_title : null;
  const titleColor = title ? RARITY_COLORS[title.rarity] ?? "#cbd5e1" : null;
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
      {title && (
        <div
          data-testid="equipped-title"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: titleColor ?? undefined,
            marginBottom: 4,
            letterSpacing: 0.2,
          }}
        >
          {title.name}
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">
          Lv. {data.level}{" "}
          <span className="text-slate-400 text-sm font-normal">— {data.display_name}</span>
        </h2>
        <span data-testid="xp-total" className="text-slate-300 text-sm">
          {current} XP
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}
