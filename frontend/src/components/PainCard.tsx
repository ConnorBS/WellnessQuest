"use client";

import Link from "next/link";

import { usePainSummary } from "@/hooks/usePain";
import { painColor, REGION_LABELS } from "@/lib/bodyMap";

export function PainCard() {
  const summary = usePainSummary();
  const latest = summary.data?.latest;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <h2 className="text-lg font-semibold">Pain &amp; symptoms</h2>
        <Link href="/pain" style={{ fontSize: 13, color: "var(--wq-accent)" }}>
          See all →
        </Link>
      </header>
      {summary.isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : !latest ? (
        <p className="mt-3 text-sm text-slate-400">
          No check-ins yet —{" "}
          <Link href="/pain" style={{ color: "var(--wq-accent)" }}>
            log pain &amp; symptoms
          </Link>
          .
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: painColor(latest.pain_level),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                color: "var(--wq-on-accent)",
              }}
            >
              {latest.pain_level}
            </span>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ fontSize: 14 }}>Pain level {latest.pain_level}/10</span>
              <span style={{ color: "var(--wq-muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {latest.locations.length > 0
                  ? latest.locations.map((l) => REGION_LABELS[l] ?? l).join(", ")
                  : "No areas marked"}
              </span>
            </div>
          </div>
          {latest.symptoms.length > 0 && (
            <p style={{ color: "var(--wq-muted)", fontSize: 12, marginTop: 6 }}>
              {latest.symptoms.map((s) => `${s.name} (${s.severity})`).join(" · ")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
