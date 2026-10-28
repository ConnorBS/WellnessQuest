"use client";

import { useMemo, useState } from "react";

import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { Modal } from "@/components/Modal";
import {
  RefluxForm,
  SeverityPicker,
  TriggerPicker,
} from "@/components/reflux/RefluxForm";
import {
  useDeleteReflux,
  useRefluxHistory,
  useUpdateReflux,
} from "@/hooks/useReflux";
import { SEVERITY_META, topTriggers, TRIGGER_LABELS } from "@/lib/reflux";
import type { RefluxEntry, RefluxSeverity, RefluxTrigger } from "@/lib/schemas";

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function EditModal({ entry, onClose }: { entry: RefluxEntry; onClose: () => void }) {
  const update = useUpdateReflux();
  const [severity, setSeverity] = useState<RefluxSeverity>(entry.severity);
  const [triggers, setTriggers] = useState<RefluxTrigger[]>(entry.triggers);
  const [note, setNote] = useState(entry.note ?? "");
  // null = "keep the original time" — the picker stays collapsed until opened.
  const [occurredAt, setOccurredAt] = useState<string | null>(null);

  return (
    <Modal title="Edit episode" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SeverityPicker value={severity} onChange={setSeverity} />
        <TriggerPicker value={triggers} onChange={setTriggers} />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
          maxLength={500}
        />
        <OccurredAtField
          value={occurredAt}
          onChange={setOccurredAt}
          defaultLabel={formatTime(entry.occurred_at)}
          initialPickerIso={entry.occurred_at}
        />
        <button
          type="button"
          disabled={update.isPending}
          style={primaryBtn}
          onClick={() =>
            update.mutate(
              {
                id: entry.id,
                patch: {
                  severity,
                  triggers,
                  note: note.trim() || null,
                  ...(occurredAt !== null ? { occurred_at: occurredAt } : {}),
                },
              },
              { onSuccess: onClose },
            )
          }
        >
          {update.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

export default function RefluxPage() {
  const history = useRefluxHistory(200);
  const del = useDeleteReflux();
  const [showForm, setShowForm] = useState(true);
  const [editing, setEditing] = useState<RefluxEntry | null>(null);
  const entries = useMemo(() => history.data ?? [], [history.data]);
  const triggers = useMemo(() => topTriggers(entries, 30), [entries]);
  const recentCount = useMemo(() => {
    const cutoff = Date.now() - 30 * 86_400_000;
    return entries.filter((e) => new Date(e.occurred_at).getTime() >= cutoff).length;
  }, [entries]);

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 className="text-lg font-semibold">Log an episode</h2>
          <button type="button" onClick={() => setShowForm((v) => !v)} style={primaryBtn}>
            {showForm ? "Hide" : "Add episode"}
          </button>
        </header>
        {showForm && <RefluxForm />}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 4 }}>
          Usual suspects
        </h2>
        <p style={{ color: "var(--wq-muted)", fontSize: 12, marginBottom: 12 }}>
          Ranked by how often each trigger was ticked, weighted by how bad the
          episode was, across the {recentCount} episode
          {recentCount === 1 ? "" : "s"} in the last 30 days.
        </p>
        {triggers.length === 0 ? (
          <p style={{ color: "var(--wq-muted)" }}>
            Nothing to rank yet — tick the triggers you suspect when you log an
            episode and a pattern will show up here.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {triggers.map((t) => (
              <li key={t.trigger} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 8 }}>
                  <span>{TRIGGER_LABELS[t.trigger]}</span>
                  <span style={{ color: "var(--wq-muted)", whiteSpace: "nowrap" }}>
                    {t.count}× ·{" "}
                    <span style={{ color: SEVERITY_META[t.typicalSeverity].color }}>
                      {SEVERITY_META[t.typicalSeverity].label.toLowerCase()}
                    </span>
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--wq-surface-2)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.round(t.share * 100)}%`,
                      height: "100%",
                      background: SEVERITY_META[t.typicalSeverity].color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          History
        </h2>
        {history.isLoading ? (
          <p style={{ color: "var(--wq-muted)" }}>Loading…</p>
        ) : entries.length === 0 ? (
          <p style={{ color: "var(--wq-muted)" }}>No episodes yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.map((e) => {
              const meta = SEVERITY_META[e.severity];
              return (
                <li
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--wq-surface-2)",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span
                      aria-hidden="true"
                      style={{ width: 10, height: 10, borderRadius: 999, background: meta.color, flexShrink: 0 }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>
                        {meta.label}
                        {e.triggers.length > 0 && (
                          <span style={{ color: "var(--wq-muted)", fontWeight: 400, fontSize: 12 }}>
                            {" "}· {e.triggers.map((t) => TRIGGER_LABELS[t]).join(", ")}
                          </span>
                        )}
                      </span>
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
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => setEditing(e)} style={subtleBtn}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this episode?")) del.mutate(e.id);
                      }}
                      style={dangerBtn}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {editing ? <EditModal entry={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
