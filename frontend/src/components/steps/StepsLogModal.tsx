"use client";

import { useState } from "react";

import { Modal } from "@/components/Modal";
import { OccurredAtField } from "@/components/forms/OccurredAtField";
import { useAddSteps } from "@/hooks/useAddSteps";
import { ApiError } from "@/lib/api";
import { useViewedDay } from "@/lib/day-context";
import { occurredAtFor } from "@/lib/occurredAt";
import { uuidv4 } from "@/lib/uuid";

interface Props {
  onClose: () => void;
}

// Steps land as append-only deltas, same as the Home Assistant feed, so a
// manual log is "add this many steps to the day" rather than "the day's total
// is now this". These shortcuts are rough distances, not precise conversions.
const QUICK_ADDS = [500, 1000, 2500, 5000];

export function StepsLogModal({ onClose }: Props) {
  const [count, setCount] = useState<number | "">("");
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { viewedDay, isToday } = useViewedDay();
  const add = useAddSteps();

  const countNum = typeof count === "number" ? count : Number(count);
  const valid = Number.isFinite(countNum) && countNum >= 1 && countNum <= 200_000;

  function log(value: number) {
    setErrorMsg(null);
    add.mutate(
      {
        count: Math.round(value),
        client_id: uuidv4(),
        ...(occurredAt ? { occurred_at: occurredAt } : {}),
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => setErrorMsg(formatLogError(err)),
      },
    );
  }

  return (
    <Modal title="Log steps" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {QUICK_ADDS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              data-testid={`steps-quick-${n}`}
              style={chipStyle}
            >
              +{n.toLocaleString()}
            </button>
          ))}
        </div>

        <label>
          <span style={labelStyle}>Steps to add</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={200000}
            placeholder="e.g. 3000"
            value={count}
            onChange={(e) => setCount(e.target.value === "" ? "" : Number(e.target.value))}
            style={inputStyle}
            data-testid="steps-log-count"
          />
        </label>

        <OccurredAtField
          value={occurredAt}
          onChange={setOccurredAt}
          defaultLabel={isToday ? "now" : "noon"}
          initialPickerIso={occurredAtFor(viewedDay, isToday)}
        />

        {errorMsg ? (
          <p role="alert" data-testid="steps-log-error" style={errorStyle}>
            {errorMsg}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => valid && log(countNum)}
          disabled={!valid || add.isPending}
          data-testid="steps-log-submit"
          style={submitStyle(!valid || add.isPending)}
        >
          {add.isPending ? "Logging…" : "Log it"}
        </button>
      </div>
    </Modal>
  );
}

function formatLogError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
    return `Server error ${err.status}`;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Couldn't reach the server. Check your connection and try again.";
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 14,
};

const chipStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "#1e293b",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 999,
  fontSize: 13,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  padding: "8px 10px",
  fontSize: 13,
  color: "#fca5a5",
  background: "rgba(248,113,113,0.08)",
  border: "1px solid rgba(248,113,113,0.35)",
  borderRadius: 6,
};

function submitStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "#1e293b" : "#10b981",
    color: disabled ? "#64748b" : "white",
    border: "none",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
}
