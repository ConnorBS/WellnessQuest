"use client";

import Link from "next/link";
import { useState } from "react";

import { Modal } from "@/components/Modal";
import { quickLogBtn } from "@/components/quickLogButton";
import { RefluxForm } from "@/components/reflux/RefluxForm";
import { useRefluxSummary } from "@/hooks/useReflux";
import { SEVERITY_META, TRIGGER_LABELS } from "@/lib/reflux";

export function RefluxCard({ showQuickLog = false }: { showQuickLog?: boolean }) {
  const summary = useRefluxSummary();
  const [showLog, setShowLog] = useState(false);
  const latest = summary.data?.latest;
  const todayCount = summary.data?.today_count ?? 0;
  const weekCount = summary.data?.week_count ?? 0;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <h2 className="text-lg font-semibold">Acid reflux</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {showQuickLog && (
            <button
              type="button"
              onClick={() => setShowLog(true)}
              data-testid="dashboard-log-reflux"
              style={quickLogBtn}
            >
              + Log
            </button>
          )}
          <Link href="/reflux" style={{ fontSize: 13, color: "var(--wq-accent)" }}>
            See all →
          </Link>
        </div>
      </header>
      {summary.isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : !latest ? (
        <p className="mt-3 text-sm text-slate-400">
          No episodes logged —{" "}
          <Link href="/reflux" style={{ color: "var(--wq-accent)" }}>
            log one when it happens
          </Link>
          .
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: SEVERITY_META[latest.severity].color }}>
              {SEVERITY_META[latest.severity].label}
            </span>
            <span style={{ color: "var(--wq-muted)", fontSize: 12 }}>
              {new Date(latest.occurred_at).toLocaleString(undefined, {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {latest.triggers.length > 0
                ? ` · ${latest.triggers.map((t) => TRIGGER_LABELS[t]).join(", ")}`
                : ""}
            </span>
          </div>
          <p style={{ color: "var(--wq-muted)", fontSize: 12, marginTop: 6 }}>
            {todayCount} today · {weekCount} in the last 7 days
          </p>
        </>
      )}
      {showQuickLog && showLog ? (
        <Modal title="Log a reflux episode" onClose={() => setShowLog(false)}>
          <RefluxForm onSaved={() => setShowLog(false)} />
        </Modal>
      ) : null}
    </section>
  );
}
