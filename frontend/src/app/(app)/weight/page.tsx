"use client";

import { useMemo, useState } from "react";

import { EditWeightEntryDrawer } from "@/components/weight/EditWeightEntryDrawer";
import { WeightForm } from "@/components/weight/WeightForm";
import { WeightSparkline } from "@/components/weight/WeightSparkline";
import { useMe } from "@/hooks/useMe";
import { useDeleteWeight, useWeightHistory, useWeightTrend } from "@/hooks/useWeight";
import type { WeightEntry } from "@/lib/schemas";
import { formatWeight } from "@/lib/units";

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "var(--wq-accent)",
  color: "var(--wq-on-accent)",
  border: 0,
  borderRadius: 6,
  fontWeight: 500,
};

const dangerBtn: React.CSSProperties = {
  padding: "4px 8px",
  background: "transparent",
  color: "#fca5a5",
  border: "1px solid #7f1d1d",
  borderRadius: 6,
  fontSize: 12,
};

const subtleBtn: React.CSSProperties = {
  padding: "4px 8px",
  background: "transparent",
  color: "var(--wq-text-2)",
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
  fontSize: 12,
};

const weekBtn: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 0",
  background: "transparent",
  color: "var(--wq-text)",
  border: 0,
  borderBottom: "1px solid var(--wq-surface-2)",
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
};

interface WeekGroup {
  key: string; // ISO date of week start
  label: string;
  entries: WeightEntry[];
  meanKg: number;
}

// Monday-anchored week start in local time so the grouping matches how
// users think about "this week / last week" on their device.
function weekStart(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = out.getDay(); // 0 = Sun
  const offset = (dow + 6) % 7; // Mon=0, Sun=6
  out.setDate(out.getDate() - offset);
  return out;
}

function groupByWeek(entries: WeightEntry[]): WeekGroup[] {
  const buckets = new Map<string, WeightEntry[]>();
  for (const e of entries) {
    const ws = weekStart(new Date(e.occurred_at));
    const key = ws.toISOString().slice(0, 10);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(e);
  }
  const groups: WeekGroup[] = [];
  for (const [key, items] of buckets) {
    const meanKg =
      items.reduce((acc, e) => acc + e.weight_kg, 0) / items.length;
    const ws = new Date(key);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    groups.push({
      key,
      label: `${fmt(ws)} – ${fmt(we)}`,
      entries: items,
      meanKg,
    });
  }
  // Newest week first.
  groups.sort((a, b) => (a.key < b.key ? 1 : -1));
  return groups;
}

export default function WeightPage() {
  const { data: me } = useMe();
  const history = useWeightHistory(180);
  const trend = useWeightTrend(180);
  const del = useDeleteWeight();
  const unit = me?.weight_unit ?? "kg";
  const [showForm, setShowForm] = useState(true);
  const [editing, setEditing] = useState<WeightEntry | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const weeks = useMemo(
    () => (history.data ? groupByWeek(history.data) : []),
    [history.data],
  );

  // Expand the most recent week by default so the page isn't a wall of
  // collapsed rows on first load.
  const visibleExpanded = useMemo(() => {
    if (expanded.size > 0) return expanded;
    const first = weeks[0];
    return first ? new Set([first.key]) : expanded;
  }, [expanded, weeks]);

  function toggleWeek(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      // Seed from the default-expansion if the user hasn't interacted yet,
      // so the first click doesn't accidentally collapse everything.
      const first = weeks[0];
      if (next.size === 0 && first) next.add(first.key);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 className="text-lg font-semibold">Log weight</h2>
          <button type="button" onClick={() => setShowForm((v) => !v)} style={primaryBtn}>
            {showForm ? "Hide" : "Add entry"}
          </button>
        </header>
        {showForm && (
          <WeightForm unit={unit} onSaved={() => { /* keep form open; cache invalidation refreshes */ }} />
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Trend
        </h2>
        <p style={{ color: "var(--wq-muted)", fontSize: 13, margin: "0 0 12px" }}>
          Daily weight fluctuates 1–3 lb from water, food, and sodium. The
          smoothed line is your real signal — the faint dots are individual
          readings.
        </p>
        {history.isLoading ? (
          <p style={{ color: "var(--wq-muted)" }}>Loading…</p>
        ) : !history.data || history.data.length < 2 ? (
          <p style={{ color: "var(--wq-muted)" }}>
            {history.data && history.data.length === 1
              ? "One entry so far — log a few more to see your trend."
              : "No entries yet."}
          </p>
        ) : (
          <WeightSparkline
            entries={history.data}
            unit={unit}
            height={140}
            trend={trend.data?.points ?? null}
          />
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          History by week
        </h2>
        {history.isLoading ? (
          <p style={{ color: "var(--wq-muted)" }}>Loading…</p>
        ) : weeks.length === 0 ? (
          <p style={{ color: "var(--wq-muted)" }}>No entries yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {weeks.map((g) => {
              const isOpen = visibleExpanded.has(g.key);
              return (
                <li key={g.key} style={{ display: "block" }}>
                  <button
                    type="button"
                    onClick={() => toggleWeek(g.key)}
                    style={weekBtn}
                    aria-expanded={isOpen}
                  >
                    <span style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 500 }}>{g.label}</span>
                      <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>
                        avg {formatWeight(g.meanKg, unit)} · {g.entries.length} entr
                        {g.entries.length === 1 ? "y" : "ies"}
                      </span>
                    </span>
                    <span style={{ color: "var(--wq-muted-2)", fontSize: 12 }}>
                      {isOpen ? "▾" : "▸"}
                    </span>
                  </button>
                  {isOpen && (
                    <ul
                      style={{
                        listStyle: "none",
                        padding: "4px 0 12px 12px",
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {g.entries.map((e) => (
                        <li
                          key={e.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 0",
                            gap: 8,
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: 500 }}>{formatWeight(e.weight_kg, unit)}</span>
                            <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>
                              {new Date(e.occurred_at).toLocaleString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {e.note ? ` · ${e.note}` : ""}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" onClick={() => setEditing(e)} style={subtleBtn}>
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("Delete this entry?")) del.mutate(e.id);
                              }}
                              style={dangerBtn}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {editing ? (
        <EditWeightEntryDrawer
          entry={editing}
          unit={unit}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
