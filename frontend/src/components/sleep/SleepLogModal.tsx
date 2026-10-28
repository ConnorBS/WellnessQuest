"use client";

import { useState } from "react";

import { Modal } from "@/components/Modal";
import { useAddSleep } from "@/hooks/useAddSleep";
import { ApiError } from "@/lib/api";
import { useViewedDay } from "@/lib/day-context";
import { formatDuration } from "@/lib/duration";
import { uuidv4 } from "@/lib/uuid";

interface Props {
  onClose: () => void;
}

const MINUTES_PER_DAY = 1440;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A plausible night to pre-fill: woke at 7am on the viewed day, 8h in bed. */
function defaultWake(viewedDay: string, isToday: boolean): Date {
  const [y, m, d] = viewedDay.split("-").map(Number) as [number, number, number];
  const sevenAm = new Date(y, m - 1, d, 7, 0, 0, 0);
  // Logging today before 7am (or mid-nap) — don't pre-fill a future wake time,
  // the server rejects it.
  if (isToday && sevenAm.getTime() > Date.now()) return new Date();
  return sevenAm;
}

export function SleepLogModal({ onClose }: Props) {
  const { viewedDay, isToday } = useViewedDay();
  const [wake, setWake] = useState(() => toLocalInput(defaultWake(viewedDay, isToday)));
  const [bed, setBed] = useState(() =>
    toLocalInput(new Date(defaultWake(viewedDay, isToday).getTime() - 8 * 3600_000)),
  );
  const [quality, setQuality] = useState<number | "">("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const add = useAddSleep();

  const started = bed ? new Date(bed) : null;
  const ended = wake ? new Date(wake) : null;
  const durationMinutes =
    started && ended && !Number.isNaN(started.getTime()) && !Number.isNaN(ended.getTime())
      ? Math.floor((ended.getTime() - started.getTime()) / 60_000)
      : 0;

  let problem: string | null = null;
  if (!started || !ended || Number.isNaN(durationMinutes)) {
    problem = "Pick both a bedtime and a wake time.";
  } else if (durationMinutes <= 0) {
    problem = "Wake time has to be after bedtime.";
  } else if (durationMinutes > MINUTES_PER_DAY) {
    problem = "That's more than 24 hours — check the dates.";
  } else if (ended.getTime() > Date.now() + 10 * 60_000) {
    problem = "Wake time is in the future.";
  }
  const valid = problem === null;

  const qualityNum = typeof quality === "number" ? quality : Number(quality);
  const qualityValid =
    quality === "" || (Number.isFinite(qualityNum) && qualityNum >= 0 && qualityNum <= 100);

  function handleLog() {
    if (!valid || !qualityValid || !started || !ended) return;
    setErrorMsg(null);
    add.mutate(
      {
        started_at: started.toISOString(),
        ended_at: ended.toISOString(),
        quality_score: quality === "" ? null : Math.round(qualityNum),
        client_id: uuidv4(),
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => setErrorMsg(formatLogError(err)),
      },
    );
  }

  const disabled = !valid || !qualityValid || add.isPending;

  return (
    <Modal title="Log sleep" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          <span style={labelStyle}>Went to bed</span>
          <input
            type="datetime-local"
            value={bed}
            onChange={(e) => setBed(e.target.value)}
            style={inputStyle}
            data-testid="sleep-log-bed"
          />
        </label>

        <label>
          <span style={labelStyle}>Woke up</span>
          <input
            type="datetime-local"
            value={wake}
            onChange={(e) => setWake(e.target.value)}
            style={inputStyle}
            data-testid="sleep-log-wake"
          />
        </label>

        <p style={{ margin: 0, fontSize: 13, color: valid ? "var(--wq-muted)" : "#fca5a5" }}>
          {valid ? `That's ${formatDuration(durationMinutes)} of sleep.` : problem}
        </p>

        <label>
          <span style={labelStyle}>
            Quality <span style={{ color: "var(--wq-muted-2)" }}>(optional, 0–100)</span>
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            placeholder="e.g. 80"
            value={quality}
            onChange={(e) =>
              setQuality(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={inputStyle}
            data-testid="sleep-log-quality"
          />
        </label>

        {errorMsg ? (
          <p role="alert" data-testid="sleep-log-error" style={errorStyle}>
            {errorMsg}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleLog}
          disabled={disabled}
          data-testid="sleep-log-submit"
          style={{
            background: disabled ? "var(--wq-surface-2)" : "var(--wq-accent)",
            color: disabled ? "var(--wq-muted-2)" : "white",
            border: "none",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 14,
            fontWeight: 600,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.7 : 1,
          }}
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
    if (body && typeof body.detail === "string") {
      if (body.detail === "future_time") return "Wake time is in the future.";
      if (body.detail === "invalid_range") return "Wake time has to be after bedtime.";
      return body.detail;
    }
    return `Server error ${err.status}`;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Couldn't reach the server. Check your connection and try again.";
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--wq-muted)",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--wq-bg)",
  border: "1px solid var(--wq-surface-2)",
  borderRadius: 6,
  color: "var(--wq-text)",
  fontSize: 14,
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
