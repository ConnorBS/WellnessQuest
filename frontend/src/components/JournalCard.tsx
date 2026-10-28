"use client";

import Link from "next/link";
import { useState } from "react";

import { JournalComposer } from "@/components/journal/JournalComposer";
import { Modal } from "@/components/Modal";
import { quickLogBtn } from "@/components/quickLogButton";
import { useJournalSummary } from "@/hooks/useJournal";
import { useViewedDay } from "@/lib/day-context";
import { journalPreview } from "@/lib/journal";

export function JournalCard({ showQuickLog = false }: { showQuickLog?: boolean }) {
  const { viewedDay, isToday } = useViewedDay();
  const summary = useJournalSummary(viewedDay);
  const [showLog, setShowLog] = useState(false);
  const count = summary.data?.count ?? 0;
  const latest = summary.data?.latest;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <h2 className="text-lg font-semibold">Journal</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {showQuickLog && (
            <button
              type="button"
              onClick={() => setShowLog(true)}
              data-testid="dashboard-log-journal"
              style={quickLogBtn}
            >
              + Note
            </button>
          )}
          <Link href="/journal" style={{ fontSize: 13, color: "var(--wq-accent)" }}>
            See all →
          </Link>
        </div>
      </header>
      {summary.isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : count === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          Nothing written{isToday ? " today" : " for this day"} yet —{" "}
          <Link href="/journal" style={{ color: "var(--wq-accent)" }}>
            note something down
          </Link>
          .
        </p>
      ) : (
        <>
          <p style={{ fontSize: 14, marginTop: 8, color: "var(--wq-text)" }}>
            {journalPreview(latest?.body ?? "")}
          </p>
          <p style={{ color: "var(--wq-muted)", fontSize: 12, marginTop: 6 }}>
            {count} note{count === 1 ? "" : "s"}
            {isToday ? " today" : " that day"}.
          </p>
        </>
      )}
      {showQuickLog && showLog ? (
        <Modal title="What happened?" onClose={() => setShowLog(false)}>
          <JournalComposer
            date={viewedDay}
            autoFocus
            dateHint={isToday ? undefined : `Filed under ${viewedDay}.`}
            onSaved={() => setShowLog(false)}
          />
        </Modal>
      ) : null}
    </section>
  );
}
