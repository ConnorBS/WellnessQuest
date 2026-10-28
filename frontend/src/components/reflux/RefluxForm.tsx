"use client";

import { FormEvent, useState } from "react";

import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { useAddReflux } from "@/hooks/useReflux";
import {
  SEVERITY_META,
  SEVERITY_ORDER,
  TRIGGER_LABELS,
  TRIGGER_ORDER,
} from "@/lib/reflux";
import type { RefluxSeverity, RefluxTrigger } from "@/lib/schemas";

interface Props {
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

export function SeverityPicker({
  value,
  onChange,
}: {
  value: RefluxSeverity | null;
  onChange: (s: RefluxSeverity) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {SEVERITY_ORDER.map((s) => {
        const meta = SEVERITY_META[s];
        const selected = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-pressed={selected}
            style={{
              flex: 1,
              padding: "10px 4px",
              borderRadius: 6,
              border: selected ? `2px solid ${meta.color}` : "1px solid var(--wq-border)",
              background: selected ? `${meta.color}33` : "transparent",
              color: "var(--wq-text)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

export function TriggerPicker({
  value,
  onChange,
}: {
  value: RefluxTrigger[];
  onChange: (t: RefluxTrigger[]) => void;
}) {
  function toggle(t: RefluxTrigger) {
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {TRIGGER_ORDER.map((t) => {
        const selected = value.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            aria-pressed={selected}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: selected ? "2px solid var(--wq-accent)" : "1px solid var(--wq-border)",
              background: selected ? "var(--wq-accent)22" : "transparent",
              color: "var(--wq-text)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {TRIGGER_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}

export function RefluxForm({ onSaved }: Props) {
  const add = useAddReflux();
  const [severity, setSeverity] = useState<RefluxSeverity | null>(null);
  const [triggers, setTriggers] = useState<RefluxTrigger[]>([]);
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (severity == null) {
      setError("Pick how bad it is.");
      return;
    }
    add.mutate(
      {
        severity,
        triggers,
        note: note.trim() || null,
        ...(occurredAt ? { occurred_at: occurredAt } : {}),
      },
      {
        onSuccess: () => {
          setSeverity(null);
          setTriggers([]);
          setNote("");
          setOccurredAt(null);
          onSaved?.();
        },
        onError: () => setError("Could not save — try again."),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>How bad is it?</span>
        <div style={{ marginTop: 6 }}>
          <SeverityPicker value={severity} onChange={setSeverity} />
        </div>
      </div>

      <div>
        <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>
          Anything from the usual suspects beforehand?
        </span>
        <div style={{ marginTop: 6 }}>
          <TriggerPicker value={triggers} onChange={setTriggers} />
        </div>
      </div>

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (what you ate, what helped)"
        maxLength={500}
      />
      <OccurredAtField value={occurredAt} onChange={setOccurredAt} />
      {error && <p style={{ color: "#fca5a5", fontSize: 13 }}>{error}</p>}
      <button type="submit" disabled={add.isPending} style={primaryBtn}>
        {add.isPending ? "Saving…" : "Log episode"}
      </button>
    </form>
  );
}
