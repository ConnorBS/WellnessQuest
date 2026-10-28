"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { BodyMap } from "@/components/pain/BodyMap";
import { EditPainEntryDrawer } from "@/components/pain/EditPainEntryDrawer";
import { OccurredAtField } from "@/components/forms/OccurredAtField";
import {
  useAddPain,
  useDeletePain,
  usePainHistory,
  useSymptomCatalog,
} from "@/hooks/usePain";
import {
  painColor,
  REGION_LABELS,
  SEVERITY_META,
  SEVERITY_ORDER,
} from "@/lib/bodyMap";
import type { PainEntry, Severity } from "@/lib/schemas";

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  background: "var(--wq-accent)",
  color: "var(--wq-on-accent)",
  border: 0,
  borderRadius: 6,
  fontWeight: 600,
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

interface SymptomState {
  severity: Severity;
  duration: string;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function PainLogForm() {
  const catalog = useSymptomCatalog();
  const add = useAddPain();
  const [painLevel, setPainLevel] = useState(3);
  const [regions, setRegions] = useState<string[]>([]);
  const [symptoms, setSymptoms] = useState<Record<number, SymptomState>>({});
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleRegion(key: string) {
    setRegions((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  function setSeverity(id: number, severity: Severity) {
    setSymptoms((cur) => ({
      ...cur,
      [id]: { severity, duration: cur[id]?.duration ?? "" },
    }));
  }

  function setDuration(id: number, duration: string) {
    setSymptoms((cur) => ({
      ...cur,
      [id]: { severity: cur[id]?.severity ?? "none", duration },
    }));
  }

  function handleSubmit() {
    setError(null);
    const chosen = Object.entries(symptoms)
      .filter(([, s]) => s.severity !== "none")
      .map(([id, s]) => {
        const mins = parseInt(s.duration, 10);
        return {
          catalog_id: Number(id),
          severity: s.severity,
          duration_minutes: Number.isFinite(mins) && mins >= 0 ? mins : null,
        };
      });
    add.mutate(
      {
        pain_level: painLevel,
        note: note.trim() || null,
        locations: regions,
        symptoms: chosen,
        ...(occurredAt ? { occurred_at: occurredAt } : {}),
      },
      {
        onSuccess: () => {
          setPainLevel(3);
          setRegions([]);
          setSymptoms({});
          setNote("");
          setOccurredAt(null);
        },
        onError: () => setError("Could not save — try again."),
      },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={{ color: "var(--wq-muted)", fontSize: 12 }}>
          Pain level: <strong style={{ color: painColor(painLevel) }}>{painLevel}/10</strong>
        </label>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={painLevel}
          onChange={(e) => setPainLevel(Number(e.target.value))}
          style={{ width: "100%", accentColor: painColor(painLevel) }}
        />
      </div>

      <div>
        <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>Where does it hurt? (tap)</span>
        <BodyMap selected={regions} onToggle={toggleRegion} />
        {regions.length > 0 && (
          <p style={{ color: "var(--wq-text-2)", fontSize: 12, marginTop: 4, textAlign: "center" }}>
            {regions.map((r) => REGION_LABELS[r] ?? r).join(", ")}
          </p>
        )}
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>Symptoms</span>
          <Link href="/settings/pain" style={{ color: "var(--wq-accent)", fontSize: 12 }}>
            Edit list
          </Link>
        </div>
        {catalog.isLoading ? (
          <p style={{ color: "var(--wq-muted)", fontSize: 13 }}>Loading…</p>
        ) : (catalog.data ?? []).length === 0 ? (
          <p style={{ color: "var(--wq-muted)", fontSize: 13 }}>
            No symptoms yet — add some under{" "}
            <Link href="/settings/pain" style={{ color: "var(--wq-accent)" }}>
              Edit list
            </Link>
            .
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
            {(catalog.data ?? []).map((c) => {
              const st = symptoms[c.id] ?? { severity: "none" as Severity, duration: "" };
              return (
                <li key={c.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 13 }}>{c.name}</span>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                    {SEVERITY_ORDER.map((sev) => {
                      const on = st.severity === sev;
                      const meta = SEVERITY_META[sev];
                      return (
                        <button
                          key={sev}
                          type="button"
                          onClick={() => setSeverity(c.id, sev)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: on ? `2px solid ${meta.color}` : "1px solid var(--wq-border)",
                            background: on ? `${meta.color}22` : "transparent",
                            color: "var(--wq-text)",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                    {st.severity !== "none" && (
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={st.duration}
                        onChange={(e) => setDuration(c.id, e.target.value)}
                        placeholder="mins"
                        style={{ width: 70, padding: "4px 6px" }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note"
        maxLength={500}
      />
      <OccurredAtField value={occurredAt} onChange={setOccurredAt} />
      {error && <p style={{ color: "#fca5a5", fontSize: 13 }}>{error}</p>}
      <button type="button" onClick={handleSubmit} disabled={add.isPending} style={primaryBtn}>
        {add.isPending ? "Saving…" : "Log check-in"}
      </button>
    </div>
  );
}

function ThirtyDayStrip({ entries }: { entries: PainEntry[] }) {
  const maxByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const key = dayKey(e.occurred_at);
      m.set(key, Math.max(m.get(key) ?? 0, e.pain_level));
    }
    return m;
  }, [entries]);

  const today = new Date();
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    days.push({ key, level: maxByDay.get(key) });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
      {days.map((d) => (
        <div
          key={d.key}
          title={d.level != null ? `Pain ${d.level}/10` : "No check-in"}
          style={{
            aspectRatio: "1",
            borderRadius: 6,
            border: "1px solid var(--wq-surface-2)",
            background: d.level != null ? painColor(d.level) : "var(--wq-surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: d.level != null ? "#0b1220" : "var(--wq-border-strong)",
            fontWeight: 600,
          }}
        >
          {d.level ?? ""}
        </div>
      ))}
    </div>
  );
}

export default function PainPage() {
  const history = usePainHistory(200);
  const del = useDeletePain();
  const [showForm, setShowForm] = useState(true);
  const [editing, setEditing] = useState<PainEntry | null>(null);
  const entries = history.data ?? [];

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 className="text-lg font-semibold">Log pain &amp; symptoms</h2>
          <button type="button" onClick={() => setShowForm((v) => !v)} style={primaryBtn}>
            {showForm ? "Hide" : "Add check-in"}
          </button>
        </header>
        {showForm && <PainLogForm />}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Last 30 days
        </h2>
        {entries.length === 0 ? (
          <p style={{ color: "var(--wq-muted)" }}>No check-ins yet.</p>
        ) : (
          <ThirtyDayStrip entries={entries} />
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          History
        </h2>
        {history.isLoading ? (
          <p style={{ color: "var(--wq-muted)" }}>Loading…</p>
        ) : entries.length === 0 ? (
          <p style={{ color: "var(--wq-muted)" }}>No entries yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((e) => (
              <li
                key={e.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--wq-surface-2)",
                }}
              >
                <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 6,
                      background: painColor(e.pain_level),
                      color: "var(--wq-on-accent)",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {e.pain_level}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: "var(--wq-text-2)" }}>
                      {e.locations.length > 0
                        ? e.locations.map((l) => REGION_LABELS[l] ?? l).join(", ")
                        : "No areas marked"}
                    </span>
                    {e.symptoms.length > 0 && (
                      <span style={{ fontSize: 12, color: "var(--wq-muted)" }}>
                        {e.symptoms
                          .map((s) => `${s.name}: ${s.severity}${s.duration_minutes ? ` (${s.duration_minutes}m)` : ""}`)
                          .join(" · ")}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--wq-muted-2)" }}>
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
                </div>
                <div style={{ display: "flex", gap: 6, alignSelf: "start", flexShrink: 0 }}>
                  <button type="button" onClick={() => setEditing(e)} style={subtleBtn}>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this check-in?")) del.mutate(e.id);
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
      </section>

      {editing ? (
        <EditPainEntryDrawer entry={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
