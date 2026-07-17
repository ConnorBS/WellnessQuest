"use client";

import Link from "next/link";
import { useState } from "react";

import { Modal } from "@/components/Modal";
import { MoodForm } from "@/components/mood/MoodForm";
import { quickLogBtn } from "@/components/quickLogButton";
import { useMoodSummary } from "@/hooks/useMood";
import { ENERGY_LABELS, MOOD_META } from "@/lib/mood";

export function MoodCard({ showQuickLog = false }: { showQuickLog?: boolean }) {
  const summary = useMoodSummary();
  const [showLog, setShowLog] = useState(false);
  const latest = summary.data?.latest;
  const todayCount = summary.data?.today_count ?? 0;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <h2 className="text-lg font-semibold">Mood</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {showQuickLog && (
            <button
              type="button"
              onClick={() => setShowLog(true)}
              data-testid="dashboard-log-mood"
              style={quickLogBtn}
            >
              + Log
            </button>
          )}
          <Link href="/mood" style={{ fontSize: 13, color: "#10b981" }}>
            See all →
          </Link>
        </div>
      </header>
      {summary.isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : !latest ? (
        <p className="mt-3 text-sm text-slate-400">
          No check-ins yet —{" "}
          <Link href="/mood" style={{ color: "#10b981" }}>
            log how you feel
          </Link>
          .
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <span style={{ fontSize: 28 }}>{MOOD_META[latest.mood].emoji}</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 18, fontWeight: 600 }}>
                {MOOD_META[latest.mood].label}
              </span>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>
                {ENERGY_LABELS[latest.energy]} energy ·{" "}
                {new Date(latest.occurred_at).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>
            {todayCount === 0
              ? "No check-ins today yet."
              : `${todayCount} check-in${todayCount === 1 ? "" : "s"} today.`}
          </p>
        </>
      )}
      {showQuickLog && showLog ? (
        <Modal title="How are you feeling?" onClose={() => setShowLog(false)}>
          <MoodForm onSaved={() => setShowLog(false)} />
        </Modal>
      ) : null}
    </section>
  );
}
