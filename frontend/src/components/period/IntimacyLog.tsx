"use client";

import { useMemo, useState } from "react";

import { Modal } from "@/components/Modal";
import {
  useAddIntimacy,
  useDeleteIntimacy,
  useIntimacyHistory,
  useUpdateIntimacy,
} from "@/hooks/useIntimacy";
import type { CycleStats } from "@/lib/cycle";
import { dayKey, parseDay } from "@/lib/cycle";
import {
  describeEntry,
  isFertileWindowRisk,
  KIND_LABELS,
  KIND_ORDER,
  PROTECTION_LABELS,
  PROTECTION_ORDER,
  TAG_LABELS,
  TAG_ORDER,
} from "@/lib/intimacy";
import type {
  IntimacyEntry,
  IntimacyKind,
  IntimacyTag,
  ProtectionValue,
} from "@/lib/schemas";

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "var(--wq-accent)",
  color: "var(--wq-on-accent)",
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

const linkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#38bdf8",
  fontSize: 12,
  padding: 0,
  cursor: "pointer",
};

function chipStyle(selected: boolean, colour = "var(--wq-accent)"): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: selected ? `2px solid ${colour}` : "1px solid var(--wq-border)",
    background: selected ? `${colour}22` : "transparent",
    color: "var(--wq-text)",
    fontSize: 12,
    cursor: "pointer",
  };
}

function fmtDay(iso: string): string {
  return parseDay(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function Editor({
  existing,
  defaultDate,
  onClose,
}: {
  existing: IntimacyEntry | null;
  defaultDate: string;
  onClose: () => void;
}) {
  const add = useAddIntimacy();
  const update = useUpdateIntimacy();
  const del = useDeleteIntimacy();

  const [date, setDate] = useState(existing?.entry_date ?? defaultDate);
  const [kind, setKind] = useState<IntimacyKind>(existing?.kind ?? "partnered");
  const [protection, setProtection] = useState<ProtectionValue>(
    existing?.protection ?? "unspecified",
  );
  const [tags, setTags] = useState<IntimacyTag[]>(existing?.tags ?? []);
  const [note, setNote] = useState(existing?.note ?? "");

  const pending = add.isPending || update.isPending;
  const error = add.error ?? update.error;

  function toggleTag(t: IntimacyTag) {
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  function save() {
    const payload = {
      entry_date: date,
      kind,
      // Protection has no meaning for a solo entry; don't record a stale answer
      // if the user flipped the kind after picking one.
      protection: kind === "solo" ? ("unspecified" as ProtectionValue) : protection,
      tags,
      note: note.trim() || null,
    };
    if (existing) {
      update.mutate({ id: existing.id, ...payload }, { onSuccess: onClose });
    } else {
      add.mutate(payload, { onSuccess: onClose });
    }
  }

  return (
    <Modal title={existing ? "Edit entry" : "Log sexual activity"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>Date</span>
          <input
            type="date"
            value={date}
            max={dayKey(new Date())}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <div>
          <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>Kind</span>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                style={{ ...chipStyle(kind === k), flex: 1 }}
              >
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </div>

        {kind === "partnered" && (
          <div>
            <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>Protection</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {PROTECTION_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProtection(p)}
                  aria-pressed={protection === p}
                  style={chipStyle(protection === p, "#38bdf8")}
                >
                  {PROTECTION_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>Tags</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {TAG_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                aria-pressed={tags.includes(t)}
                style={chipStyle(tags.includes(t))}
              >
                {TAG_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
          maxLength={500}
        />

        {error && (
          <p style={{ color: "#fca5a5", fontSize: 12 }}>
            Could not save — check the date is not in the future and try again.
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <button type="button" disabled={pending} style={primaryBtn} onClick={save}>
            {pending ? "Saving…" : existing ? "Save changes" : "Log it"}
          </button>
          {existing && (
            <button
              type="button"
              disabled={del.isPending}
              style={dangerBtn}
              onClick={() => del.mutate(existing.id, { onSuccess: onClose })}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * The sexual-activity section of the period page. Several entries per day are
 * expected, so this is a log with its own add/edit/delete rather than the
 * one-row-per-day upsert the flow calendar uses.
 */
export function IntimacyLog({ stats }: { stats: CycleStats }) {
  const history = useIntimacyHistory(365);
  const entries = useMemo(() => history.data ?? [], [history.data]);
  const [editing, setEditing] = useState<IntimacyEntry | null>(null);
  const [adding, setAdding] = useState(false);

  // Newest first from the API; group into days for display.
  const days = useMemo(() => {
    const grouped = new Map<string, IntimacyEntry[]>();
    for (const e of entries) {
      const bucket = grouped.get(e.entry_date);
      if (bucket) bucket.push(e);
      else grouped.set(e.entry_date, [e]);
    }
    return [...grouped.entries()].slice(0, 20);
  }, [entries]);

  const last30 = useMemo(() => {
    const cutoff = dayKey(new Date(Date.now() - 30 * 86_400_000));
    return entries.filter((e) => e.entry_date >= cutoff).length;
  }, [entries]);

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <h2 className="text-lg font-semibold">Sexual activity</h2>
        <button type="button" style={primaryBtn} onClick={() => setAdding(true)}>
          Log
        </button>
      </header>

      {history.isLoading ? (
        <p style={{ color: "var(--wq-muted)", fontSize: 14 }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "var(--wq-muted)", fontSize: 14 }}>
          Nothing logged yet. Entries are private to your account and never leave it.
        </p>
      ) : (
        <>
          <p style={{ color: "var(--wq-muted)", fontSize: 13, marginBottom: 10 }}>
            {last30} {last30 === 1 ? "entry" : "entries"} in the last 30 days · last on{" "}
            {fmtDay(entries[0]!.entry_date)}
          </p>
          <ul
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              listStyle: "none",
            }}
          >
            {days.map(([date, rows]) => (
              <li key={date}>
                <div style={{ color: "var(--wq-muted-2)", fontSize: 11, marginBottom: 4 }}>
                  {fmtDay(date)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {rows.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        border: "1px solid var(--wq-surface-2)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          alignItems: "baseline",
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{describeEntry(e)}</span>
                        <button
                          type="button"
                          style={linkBtn}
                          onClick={() => setEditing(e)}
                        >
                          Edit
                        </button>
                      </div>
                      {isFertileWindowRisk(e, stats) && (
                        <span style={{ color: "#c084fc", fontSize: 11 }}>
                          In your estimated fertile window
                        </span>
                      )}
                      {e.tags.length > 0 && (
                        <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>
                          {e.tags.map((t) => TAG_LABELS[t]).join(" · ")}
                        </span>
                      )}
                      {e.note && (
                        <span style={{ color: "var(--wq-text-2)", fontSize: 12 }}>{e.note}</span>
                      )}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p style={{ color: "var(--wq-muted-2)", fontSize: 12, marginTop: 10 }}>
        The fertile-window note is derived from your logged cycle averages — an
        estimate, not a pregnancy test and not contraception. Turn this section off
        any time under Settings → Trackers; your entries are kept.
      </p>

      {(adding || editing) && (
        <Editor
          existing={editing}
          defaultDate={dayKey(new Date())}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
