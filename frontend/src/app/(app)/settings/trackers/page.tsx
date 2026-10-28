"use client";

import Link from "next/link";

import {
  useFeatureList,
  useReorderFeatures,
  useToggleFeature,
} from "@/hooks/useFeatures";

const arrowBtn: React.CSSProperties = {
  padding: "2px 8px",
  background: "transparent",
  color: "var(--wq-text-2)",
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
  fontSize: 12,
  lineHeight: 1.2,
};

export default function TrackersSettingsPage() {
  const { data, isLoading } = useFeatureList();
  const toggle = useToggleFeature();
  const reorder = useReorderFeatures();

  const items = data?.features ?? [];

  function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    reorder.mutate(next.map((f) => f.key));
  }

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Trackers
        </h2>
        <p style={{ color: "var(--wq-muted)", fontSize: 14, marginBottom: 16 }}>
          Turn a tracker off to hide it everywhere — its dashboard card, its top-nav
          link, and its settings page all disappear (your data is kept). Use the arrows
          to set the order your cards appear on the dashboard. Colours and the
          non-tracker sections (XP bar, streaks, footer) live under{" "}
          <Link href="/settings/appearance" style={{ color: "var(--wq-accent)" }}>
            Appearance
          </Link>
          .
        </p>

        {isLoading || !data ? (
          <p style={{ color: "var(--wq-muted)" }}>Loading...</p>
        ) : (
          <ul style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {items.map((f, i) => (
              <li
                key={f.key}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button
                    type="button"
                    style={arrowBtn}
                    aria-label={`Move ${f.label} up`}
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reorder.isPending}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    style={arrowBtn}
                    aria-label={`Move ${f.label} down`}
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1 || reorder.isPending}
                  >
                    ↓
                  </button>
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 15,
                    flex: 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    disabled={toggle.isPending}
                    onChange={(e) => toggle.mutate({ key: f.key, enabled: e.target.checked })}
                  />
                  {f.label}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
