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
  background: "#10b981",
  color: "#0b1220",
  border: 0,
  borderRadius: 6,
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
        <p style={{ color: "#94a3b8", fontSize: 12, margin: 0 }}>{dateHint}</p>
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
        <span style={{ color: "#64748b", fontSize: 12 }}>
          {trimmed.length}/{JOURNAL_BODY_MAX}
        </span>
      </div>
    </form>
  );
}
