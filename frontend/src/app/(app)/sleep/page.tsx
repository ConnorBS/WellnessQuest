"use client";

import { useState } from "react";

import { SleepCard } from "@/components/SleepCard";
import { SleepLogModal } from "@/components/sleep/SleepLogModal";
import { useDeleteSleep, useSleepRecent } from "@/hooks/useAddSleep";
import { formatDuration } from "@/lib/duration";

function formatNight(startedAt: string, endedAt: string): string {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const time = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${end.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${time(start)} → ${time(end)}`;
}

export default function SleepPage() {
  const recent = useSleepRecent(30);
  const del = useDeleteSleep();
  const [showLog, setShowLog] = useState(false);
  const entries = recent.data ?? [];

  return (
    <>
      <SleepCard />
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <h2 className="text-lg font-semibold">Recent nights</h2>
          <button
            type="button"
            onClick={() => setShowLog(true)}
            data-testid="open-sleep-log"
            style={{
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Log sleep
          </button>
        </header>
        {recent.isLoading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-slate-400 text-sm">No sessions yet.</p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {entries.map((e) => (
              <li
                key={e.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span>{formatDuration(e.duration_minutes)}</span>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>
                    {formatNight(e.started_at, e.ended_at)}
                    {e.quality_score != null && ` · quality ${e.quality_score}/100`}
                    {` · ${e.source}`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => del.mutate(e.id)}
                  disabled={del.isPending}
                  title="Delete session"
                  aria-label="Delete session"
                  style={{
                    color: "#94a3b8",
                    background: "transparent",
                    border: "none",
                    padding: 4,
                    fontSize: 16,
                    lineHeight: 1,
                    cursor: del.isPending ? "not-allowed" : "pointer",
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {showLog ? <SleepLogModal onClose={() => setShowLog(false)} /> : null}
    </>
  );
}
