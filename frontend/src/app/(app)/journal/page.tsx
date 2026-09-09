"use client";

import { useMemo, useState } from "react";

import { JournalComposer } from "@/components/journal/JournalComposer";
import {
  useDeleteJournalEntry,
  useJournalDay,
  useJournalRecent,
  useUpdateJournalEntry,
} from "@/hooks/useJournal";
import { useViewedDay } from "@/lib/day-context";
import { JOURNAL_BODY_MAX } from "@/lib/journal";
import type { JournalEntry } from "@/lib/schemas";

const subtleBtn: React.CSSProperties = {
  padding: "4px 8px",
  background: "transparent",
  color: "#cbd5e1",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 12,
};

const dangerBtn: React.CSSProperties = {
  padding: "4px 8px",
  background: "transparent",
  color: "#fca5a5",
  border: "1px solid #7f1d1d",
  borderRadius: 6,
  fontSize: 12,
};

const primaryBtn: React.CSSProperties = {
  padding: "6px 10px",
  background: "#10b981",
  color: "#0b1220",
  border: 0,
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 96,
  padding: "8px 10px",
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 15,
  lineHeight: 1.5,
  fontFamily: "inherit",
  resize: "vertical",
};

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** One note: read-only until "Edit" swaps in a textarea over the same row. */
function EntryRow({ entry }: { entry: JournalEntry }) {
  const update = useUpdateJournalEntry();
  const remove = useDeleteJournalEntry();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.body);
  const edited = entry.updated_at !== entry.created_at;

  function save() {
    const body = draft.trim();
    if (!body) return;
    update.mutate(
      { id: entry.id, patch: { body } },
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <li
      style={{
        border: "1px solid #1e293b",
        borderRadius: 10,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {editing ? (
        <>
          <textarea
            aria-label="Edit note"
            style={textarea}
            value={draft}
            maxLength={JOURNAL_BODY_MAX}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              style={primaryBtn}
              onClick={save}
              disabled={update.isPending || !draft.trim()}
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              style={subtleBtn}
              onClick={() => {
                setDraft(entry.body);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
          {update.isError && (
            <p style={{ color: "#fca5a5", fontSize: 12, margin: 0 }}>
              Could not save that edit.
            </p>
          )}
        </>
      ) : (
        <>
          {/* Newlines are the only formatting a note has; keep them. */}
          <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 15, lineHeight: 1.55 }}>
            {entry.body}
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span style={{ color: "#64748b", fontSize: 12 }}>
              {timeOf(entry.created_at)}
              {edited ? " · edited" : ""}
            </span>
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" style={subtleBtn} onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                type="button"
                style={dangerBtn}
                disabled={remove.isPending}
                onClick={() => remove.mutate(entry.id)}
              >
                Delete
              </button>
            </span>
          </div>
        </>
      )}
    </li>
  );
}

export default function JournalPage() {
  const { viewedDay, isToday } = useViewedDay();
  const day = useJournalDay(viewedDay);
  const recent = useJournalRecent(60);
  const entries = day.data ?? [];

  // Recent notes from *other* days, grouped by day — the day switcher already
  // covers the viewed day, so repeating it here would just be noise.
  const earlier = useMemo(() => {
    const groups = new Map<string, JournalEntry[]>();
    for (const e of recent.data ?? []) {
      if (e.entry_date === viewedDay) continue;
      const bucket = groups.get(e.entry_date);
      if (bucket) bucket.push(e);
      else groups.set(e.entry_date, [e]);
    }
    return [...groups.entries()];
  }, [recent.data, viewedDay]);

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 4 }}>
          {isToday ? "Today" : formatDay(viewedDay)}
        </h2>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>
          Anything worth remembering — what you saw, who you ran into, where you
          went. Use the day arrows above to write into an earlier day.
        </p>
        <JournalComposer
          date={viewedDay}
          dateHint={isToday ? undefined : `Filing this under ${formatDay(viewedDay)}.`}
        />
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h3 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          {isToday ? "Today's notes" : "Notes that day"}
        </h3>
        {day.isLoading ? (
          <p style={{ color: "#94a3b8" }}>Loading…</p>
        ) : entries.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>Nothing written yet.</p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h3 className="text-lg font-semibold" style={{ marginBottom: 12 }}>
          Earlier
        </h3>
        {recent.isLoading ? (
          <p style={{ color: "#94a3b8" }}>Loading…</p>
        ) : earlier.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>Nothing else written yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {earlier.map(([date, items]) => (
              <div key={date}>
                <p
                  style={{
                    color: "#94a3b8",
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}
                >
                  {formatDay(date)}
                </p>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {items.map((e) => (
                    <EntryRow key={e.id} entry={e} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
