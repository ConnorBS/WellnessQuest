"use client";

import Link from "next/link";

import { useMedications } from "@/hooks/useMedications";
import { doseText } from "@/lib/medications";

export function MedicationsCard() {
  const q = useMedications("active");
  const meds = q.data ?? [];

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <h2 className="text-lg font-semibold">Medications</h2>
        <Link href="/medications" style={{ fontSize: 13, color: "#10b981" }}>
          See all →
        </Link>
      </header>
      {q.isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : meds.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          Nothing recorded —{" "}
          <Link href="/medications" style={{ color: "#10b981" }}>
            add a medication
          </Link>
          .
        </p>
      ) : (
        <>
          <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>
            {meds.length} currently taking
          </p>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "8px 0 0",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {meds.slice(0, 4).map((m) => {
              const dose = doseText(m);
              return (
                <li key={m.id} style={{ fontSize: 14, display: "flex", gap: 8 }}>
                  <span style={{ color: "#e2e8f0" }}>{m.name}</span>
                  {dose && (
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>{dose}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {meds.length > 4 && (
            <Link
              href="/medications"
              style={{ color: "#10b981", fontSize: 12, display: "inline-block", marginTop: 6 }}
            >
              +{meds.length - 4} more
            </Link>
          )}
        </>
      )}
    </section>
  );
}
