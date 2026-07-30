"use client";

import { useState } from "react";

import { StepsCard } from "@/components/StepsCard";
import { StepsLogModal } from "@/components/steps/StepsLogModal";
import { useDeleteSteps } from "@/hooks/useAddSteps";
import { useStepsToday } from "@/hooks/useStepsToday";

export default function StepsPage() {
  const { data } = useStepsToday();
  const del = useDeleteSteps();
  const [showLog, setShowLog] = useState(false);
  const entries = data?.entries ?? [];

  return (
    <>
      <StepsCard />
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
          <h2 className="text-lg font-semibold">Today</h2>
          <button
            type="button"
            onClick={() => setShowLog(true)}
            data-testid="open-steps-log"
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
            + Log steps
          </button>
        </header>
        {entries.length === 0 ? (
          <p className="text-slate-400 text-sm">No entries yet.</p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {entries.map((e) => (
              <li
                key={`${e.id}-${e.client_id ?? ""}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                }}
              >
                <span>+{e.count.toLocaleString()} steps</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {new Date(e.occurred_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {e.source}
                  </span>
                  {e.id > 0 ? (
                    <button
                      type="button"
                      onClick={() => del.mutate(e.id)}
                      disabled={del.isPending}
                      title="Delete entry"
                      aria-label="Delete entry"
                      style={{
                        ...iconBtn,
                        cursor: del.isPending ? "not-allowed" : "pointer",
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {showLog ? <StepsLogModal onClose={() => setShowLog(false)} /> : null}
    </>
  );
}

const iconBtn: React.CSSProperties = {
  color: "#94a3b8",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 4,
  fontSize: 16,
  lineHeight: 1,
};
