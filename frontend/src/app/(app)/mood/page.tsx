"use client";

import { useMemo, useState } from "react";

import { Modal } from "@/components/Modal";
import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { MoodForm } from "@/components/mood/MoodForm";
import { MoodPicker } from "@/components/mood/MoodPicker";
import {
  useDeleteMood,
  useMoodHistory,
  useUpdateMood,
} from "@/hooks/useMood";
import { ENERGY_LABELS, MOOD_META, MOOD_NOTE_MAX, moodsLabel, noteTextarea } from "@/lib/mood";
import type { MoodEntry, MoodValue } from "@/lib/schemas";

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

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Latest mood per local day, for the last N days overview strip.
function MonthlyOverview({ entries }: { entries: MoodEntry[] }) {
  const byDay = useMemo(() => {
    // entries arrive newest-first; the first seen for a day is its latest.
    const map = new Map<string, MoodValue>();
    for (const e of entries) {
      const key = localDayKey(e.occurred_at);
      if (!map.has(key)) map.set(key, e.moods[0]);
    }
    return map;
  }, [entries]);

  const days: { key: string; label: number; mood: MoodValue | null }[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    days.push({ key, label: d.getDate(), mood: byDay.get(key) ?? null });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(10, 1fr)",
        gap: 4,
      }}
    >
      {days.map((d) => {
        const meta = d.mood ? MOOD_META[d.mood] : null;
        return (
          <div
            key={d.key}
            title={meta ? meta.label : "No check-in"}
            style={{
              aspectRatio: "1",
              borderRadius: 6,
              border: "1px solid var(--wq-surface-2)",
              background: meta ? meta.color : "var(--wq-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}
          >
            {meta ? meta.emoji : <span style={{ color: "var(--wq-border-strong)" }}>{d.label}</span>}
          </div>
        );
      })}
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function EditMoodModal({ entry, onClose }: { entry: MoodEntry; onClose: () => void }) {
  const update = useUpdateMood();
  const [moods, setMoods] = useState<MoodValue[]>(entry.moods);
  const [energy, setEnergy] = useState(entry.energy);
  const [note, setNote] = useState(entry.note ?? "");
  // null = "keep the original time" — the picker stays collapsed until opened.
  const [occurredAt, setOccurredAt] = useState<string | null>(null);

  return (
    <Modal title="Edit check-in" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <MoodPicker value={moods} onChange={setMoods} />
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setEnergy(lvl)}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: 6,
                border: energy === lvl ? "2px solid var(--wq-accent)" : "1px solid var(--wq-border)",
                background: energy === lvl ? "var(--wq-accent)22" : "transparent",
                color: "var(--wq-text)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {ENERGY_LABELS[lvl]}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notes (optional)"
          maxLength={MOOD_NOTE_MAX}
          style={noteTextarea}
        />
        <OccurredAtField
          value={occurredAt}
          onChange={setOccurredAt}
          defaultLabel={formatTime(entry.occurred_at)}
          initialPickerIso={entry.occurred_at}
        />
        <button
          type="button"
          disabled={update.isPending || moods.length === 0}
          style={primaryBtn}
          onClick={() =>
            update.mutate(
              {
                id: entry.id,
                patch: {
                  moods,
                  energy,
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

export default function MoodPage() {
  const history = useMoodHistory(200);
  const del = useDeleteMood();
  const [showForm, setShowForm] = useState(true);
  const [editing, setEditing] = useState<MoodEntry | null>(null);
  const entries = history.data ?? [];

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 className="text-lg font-semibold">Log your mood</h2>
          <button type="button" onClick={() => setShowForm((v) => !v)} style={primaryBtn}>
            {showForm ? "Hide" : "Add check-in"}
          </button>
        </header>
        {showForm && <MoodForm />}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Last 30 days
        </h2>
        {entries.length === 0 ? (
          <p style={{ color: "var(--wq-muted)" }}>No check-ins yet.</p>
        ) : (
          <MonthlyOverview entries={entries} />
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
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.map((e) => {
              return (
                <li
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--wq-surface-2)",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 22, whiteSpace: "nowrap" }}>
                      {e.moods.map((m) => MOOD_META[m].emoji).join("")}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>
                        {moodsLabel(e.moods)}
                        <span style={{ color: "var(--wq-muted)", fontWeight: 400, fontSize: 12 }}>
                          {" "}· {ENERGY_LABELS[e.energy]} energy
                        </span>
                      </span>
                      <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>
                        {new Date(e.occurred_at).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {e.note ? (
                        <p
                          style={{
                            margin: "4px 0 0",
                            color: "var(--wq-text-2)",
                            fontSize: 14,
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {e.note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
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
              );
            })}
          </ul>
        )}
      </section>
      {editing ? <EditMoodModal entry={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
