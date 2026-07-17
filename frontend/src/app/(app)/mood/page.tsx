"use client";

import { useMemo, useState } from "react";

import { Modal } from "@/components/Modal";
import { MoodForm } from "@/components/mood/MoodForm";
import {
  useDeleteMood,
  useMoodHistory,
  useUpdateMood,
} from "@/hooks/useMood";
import { ENERGY_LABELS, MOOD_META, MOOD_ORDER } from "@/lib/mood";
import type { MoodEntry, MoodValue } from "@/lib/schemas";

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "#10b981",
  color: "#0b1220",
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
  color: "#cbd5e1",
  border: "1px solid #334155",
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
      if (!map.has(key)) map.set(key, e.mood);
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
              border: "1px solid #1e293b",
              background: meta ? meta.color : "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}
          >
            {meta ? meta.emoji : <span style={{ color: "#475569" }}>{d.label}</span>}
          </div>
        );
      })}
    </div>
  );
}

function EditMoodModal({ entry, onClose }: { entry: MoodEntry; onClose: () => void }) {
  const update = useUpdateMood();
  const [mood, setMood] = useState<MoodValue>(entry.mood);
  const [energy, setEnergy] = useState(entry.energy);
  const [note, setNote] = useState(entry.note ?? "");

  return (
    <Modal title="Edit check-in" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
            gap: 6,
          }}
        >
          {MOOD_ORDER.map((m) => {
            const meta = MOOD_META[m];
            const selected = mood === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMood(m)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  padding: "8px 4px",
                  borderRadius: 8,
                  border: selected ? `2px solid ${meta.color}` : "1px solid #334155",
                  background: selected ? `${meta.color}22` : "transparent",
                  color: "#e2e8f0",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 20 }}>{meta.emoji}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
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
                border: energy === lvl ? "2px solid #10b981" : "1px solid #334155",
                background: energy === lvl ? "#10b98122" : "transparent",
                color: "#e2e8f0",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {ENERGY_LABELS[lvl]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
          maxLength={500}
        />
        <button
          type="button"
          disabled={update.isPending}
          style={primaryBtn}
          onClick={() =>
            update.mutate(
              { id: entry.id, patch: { mood, energy, note: note.trim() || null } },
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
          <p style={{ color: "#94a3b8" }}>No check-ins yet.</p>
        ) : (
          <MonthlyOverview entries={entries} />
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          History
        </h2>
        {history.isLoading ? (
          <p style={{ color: "#94a3b8" }}>Loading…</p>
        ) : entries.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No entries yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.map((e) => {
              const meta = MOOD_META[e.mood];
              return (
                <li
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #1e293b",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 22 }}>{meta.emoji}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>
                        {meta.label}
                        <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 12 }}>
                          {" "}· {ENERGY_LABELS[e.energy]} energy
                        </span>
                      </span>
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>
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
