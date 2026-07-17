"use client";

import { useMemo, useState } from "react";

import { Modal } from "@/components/Modal";
import {
  useDeletePeriod,
  usePeriodHistory,
  useUpsertPeriod,
} from "@/hooks/usePeriod";
import {
  addDays,
  computeCycleStats,
  dayKey,
  FLOW_META,
  FLOW_ORDER,
  parseDay,
  SYMPTOM_LABELS,
  SYMPTOM_ORDER,
} from "@/lib/cycle";
import type { FlowValue, PeriodEntry, PeriodSymptom } from "@/lib/schemas";

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "#10b981",
  color: "#0b1220",
  border: 0,
  borderRadius: 6,
  fontWeight: 500,
};

const dangerBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "transparent",
  color: "#fca5a5",
  border: "1px solid #7f1d1d",
  borderRadius: 6,
  fontSize: 13,
};

function fmt(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DayEditor({
  date,
  existing,
  onClose,
}: {
  date: string;
  existing: PeriodEntry | undefined;
  onClose: () => void;
}) {
  const upsert = useUpsertPeriod();
  const del = useDeletePeriod();
  const [flow, setFlow] = useState<FlowValue>(existing?.flow ?? "medium");
  const [symptoms, setSymptoms] = useState<PeriodSymptom[]>(existing?.symptoms ?? []);
  const [note, setNote] = useState(existing?.note ?? "");

  function toggleSymptom(s: PeriodSymptom) {
    setSymptoms((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );
  }

  const pretty = parseDay(date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <Modal title={pretty} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>Flow</span>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {FLOW_ORDER.map((f) => {
              const meta = FLOW_META[f];
              const selected = flow === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFlow(f)}
                  style={{
                    flex: 1,
                    padding: "8px 4px",
                    borderRadius: 6,
                    border: selected ? `2px solid ${meta.color}` : "1px solid #334155",
                    background: selected ? `${meta.color}33` : "transparent",
                    color: "#e2e8f0",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>Symptoms</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {SYMPTOM_ORDER.map((s) => {
              const selected = symptoms.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSymptom(s)}
                  aria-pressed={selected}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: selected ? "2px solid #10b981" : "1px solid #334155",
                    background: selected ? "#10b98122" : "transparent",
                    color: "#e2e8f0",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {SYMPTOM_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
          maxLength={500}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <button
            type="button"
            disabled={upsert.isPending}
            style={primaryBtn}
            onClick={() =>
              upsert.mutate(
                { entry_date: date, flow, symptoms, note: note.trim() || null },
                { onSuccess: onClose },
              )
            }
          >
            {upsert.isPending ? "Saving…" : existing ? "Update day" : "Log period day"}
          </button>
          {existing && (
            <button
              type="button"
              disabled={del.isPending}
              style={dangerBtn}
              onClick={() => del.mutate(existing.id, { onSuccess: onClose })}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function PeriodPage() {
  const history = usePeriodHistory(365);
  const entries = useMemo(() => history.data ?? [], [history.data]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, PeriodEntry>();
    for (const e of entries) m.set(e.entry_date, e);
    return m;
  }, [entries]);

  const stats = useMemo(() => computeCycleStats(entries), [entries]);

  const now = new Date();
  const viewMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthLabel = viewMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const firstWeekday = viewMonth.getDay();
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();

  const predictedKeys = useMemo(() => {
    const s = new Set<string>();
    if (stats.predictedNextStart && stats.avgPeriodLength) {
      for (let i = 0; i < stats.avgPeriodLength; i++) {
        s.add(dayKey(addDays(stats.predictedNextStart, i)));
      }
    }
    return s;
  }, [stats.predictedNextStart, stats.avgPeriodLength]);

  const fertileKeys = useMemo(() => {
    const s = new Set<string>();
    if (stats.fertileStart && stats.fertileEnd) {
      let d = stats.fertileStart;
      while (d <= stats.fertileEnd) {
        s.add(dayKey(d));
        d = addDays(d, 1);
      }
    }
    return s;
  }, [stats.fertileStart, stats.fertileEnd]);

  const todayKey = dayKey(now);
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <button type="button" style={primaryBtn} onClick={() => setMonthOffset((m) => m - 1)}>
            ‹
          </button>
          <h2 className="text-lg font-semibold">{monthLabel}</h2>
          <button
            type="button"
            style={primaryBtn}
            onClick={() => setMonthOffset((m) => m + 1)}
            disabled={monthOffset >= 0}
          >
            ›
          </button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} style={{ textAlign: "center", color: "#64748b", fontSize: 11 }}>
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day == null) return <div key={`b${i}`} />;
            const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
            const key = dayKey(d);
            const entry = byDate.get(key);
            const isPredicted = predictedKeys.has(key);
            const isFertile = fertileKeys.has(key);
            const isToday = key === todayKey;
            const bg = entry ? FLOW_META[entry.flow].color : "transparent";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                title={entry ? FLOW_META[entry.flow].label : isPredicted ? "Predicted" : isFertile ? "Fertile window" : ""}
                style={{
                  aspectRatio: "1",
                  borderRadius: 8,
                  border: isToday
                    ? "2px solid #38bdf8"
                    : isPredicted
                      ? "2px dashed #fb7185"
                      : isFertile
                        ? "1px dashed #a855f7"
                        : "1px solid #1e293b",
                  background: bg,
                  color: entry ? "#fff" : "#cbd5e1",
                  fontSize: 12,
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                {day}
                {entry && entry.symptoms.length > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 2,
                      right: 3,
                      fontSize: 8,
                      color: "#fff",
                    }}
                  >
                    •
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, fontSize: 11, color: "#94a3b8" }}>
          {FLOW_ORDER.map((f) => (
            <span key={f} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: FLOW_META[f].color, display: "inline-block" }} />
              {FLOW_META[f].label}
            </span>
          ))}
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, border: "2px dashed #fb7185", display: "inline-block" }} />
            Predicted
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, border: "1px dashed #a855f7", display: "inline-block" }} />
            Fertile
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Cycle
        </h2>
        <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 6, fontSize: 14 }}>
          <dt style={{ color: "#94a3b8" }}>Avg cycle length</dt>
          <dd>{stats.avgCycleLength ? `${stats.avgCycleLength} days` : "Not enough data"}</dd>
          <dt style={{ color: "#94a3b8" }}>Avg period length</dt>
          <dd>{stats.avgPeriodLength ? `${stats.avgPeriodLength} days` : "—"}</dd>
          <dt style={{ color: "#94a3b8" }}>Next period (est.)</dt>
          <dd>{fmt(stats.predictedNextStart)}</dd>
          <dt style={{ color: "#94a3b8" }}>Fertile window (est.)</dt>
          <dd>
            {stats.fertileStart ? `${fmt(stats.fertileStart)} – ${fmt(stats.fertileEnd)}` : "—"}
          </dd>
        </dl>
        <p style={{ color: "#64748b", fontSize: 12, marginTop: 10 }}>
          Estimates from your logged history — averages only, not medical advice, and not a
          reliable form of contraception.
        </p>
      </section>

      {selected ? (
        <DayEditor date={selected} existing={byDate.get(selected)} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}
