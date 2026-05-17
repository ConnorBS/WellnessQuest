"use client";

import Link from "next/link";

import { BPCategoryChip } from "@/components/blood-pressure/BPCategoryChip";
import { useBPSummary } from "@/hooks/useBloodPressure";
import { compareToTarget } from "@/lib/bp";

export function BPCard() {
  const summary = useBPSummary();
  const latest = summary.data?.latest;
  const target = summary.data?.current_target ?? null;
  const hasTarget =
    target != null && target.target_systolic != null && target.target_diastolic != null;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Blood pressure</h2>
        <Link href="/blood-pressure" style={{ fontSize: 13, color: "#10b981" }}>
          See all →
        </Link>
      </header>
      {summary.isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : !latest ? (
        <p className="mt-3 text-sm text-slate-400">
          No readings yet —{" "}
          <Link href="/blood-pressure" style={{ color: "#10b981" }}>
            log your first
          </Link>
          .
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 28, fontWeight: 700 }}>
              {latest.systolic}/{latest.diastolic}
            </span>
            <BPCategoryChip systolic={latest.systolic} diastolic={latest.diastolic} />
            {latest.pulse != null && (
              <span style={{ color: "#94a3b8", fontSize: 13 }}>· {latest.pulse} bpm</span>
            )}
          </div>
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
            {new Date(latest.occurred_at).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {hasTarget && (
            <p style={{ color: "#cbd5e1", fontSize: 13, marginTop: 6 }}>
              Target: {target!.target_systolic}/{target!.target_diastolic} ·{" "}
              <span style={{ color: "#94a3b8" }}>
                {compareToTarget(
                  { systolic: latest.systolic, diastolic: latest.diastolic },
                  {
                    target_systolic: target!.target_systolic!,
                    target_diastolic: target!.target_diastolic!,
                  },
                )}
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
}
