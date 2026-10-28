"use client";

import { FormEvent, useState } from "react";

import { useAddJournalEntry } from "@/hooks/useJournal";
import { JOURNAL_BODY_MAX } from "@/lib/journal";

interface Props {
  /** The day the note is filed under (user-local ISO date). */
  date: string;
  /** Rendered above the textarea when the note isn't being filed under today. */
  dateHint?: string;
  autoFocus?: boolean;
  onSaved?: () => void;
}

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  background: "var(--wq-accent)",
  color: "var(--wq-on-accent)",
  border: 0,
  borderRadius: 6,
  fontWeight: 600,
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 96,
  padding: "8px 10px",
  background: "var(--wq-bg)",
  border: "1px solid var(--wq-surface-2)",
  borderRadius: 6,
  color: "var(--wq-text)",
  fontSize: 15,
  lineHeight: 1.5,
  fontFamily: "inherit",
  resize: "vertical",
};

export function JournalComposer({ date, dateHint, autoFocus, onSaved }: Props) {
  const add = useAddJournalEntry();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const trimmed = body.trim();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!trimmed) {
      setError("Write something first.");
      return;
    }
    add.mutate(
      { entry_date: date, body: trimmed },
      {
        onSuccess: () => {
          setBody("");
          onSaved?.();
        },
        onError: () => setError("Could not save — try again."),
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      {dateHint && (
        <p style={{ color: "var(--wq-muted)", fontSize: 12, margin: 0 }}>{dateHint}</p>
      )}
      <textarea
        aria-label="Journal note"
        style={textarea}
        value={body}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        maxLength={JOURNAL_BODY_MAX}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Heron on the canal, ran into Sam, the good coffee place is open again…"
      />
      {error && <p style={{ color: "#fca5a5", fontSize: 13, margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" style={primaryBtn} disabled={add.isPending}>
          {add.isPending ? "Saving…" : "Save note"}
        </button>
        <span style={{ color: "var(--wq-muted-2)", fontSize: 12 }}>
          {trimmed.length}/{JOURNAL_BODY_MAX}
        </span>
      </div>
    </form>
  );
}
