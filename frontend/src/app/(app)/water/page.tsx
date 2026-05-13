"use client";

import { useState } from "react";

import { WaterCard } from "@/components/WaterCard";
import { WaterLogModal } from "@/components/water/WaterLogModal";
import { useWaterToday } from "@/hooks/useWaterToday";
import { useDeleteWater } from "@/hooks/useAddWater";

export default function WaterPage() {
  const { data } = useWaterToday();
  const del = useDeleteWater();
  const [showLog, setShowLog] = useState(false);
  return (
    <>
      <WaterCard />
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
            data-testid="open-water-log"
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
            + Log water
          </button>
        </header>
        {!data || data.entries.length === 0 ? (
          <p className="text-slate-400 text-sm">No entries yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {data.entries.map((e) => (
              <li
                key={`${e.id}-${e.client_id ?? ""}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 14 }}
              >
                <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                  <span>+{e.ml} ml</span>
                  {e.name && (
                    <span style={{ color: "#7dd3fc", fontSize: 12, whiteSpace: "nowrap" }}>
                      {e.name}
                    </span>
                  )}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {new Date(e.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {e.source}
                  </span>
                  {e.id > 0 ? (
                    <button
                      type="button"
                      onClick={() => del.mutate(e.id)}
                      disabled={del.isPending}
                      title="Delete entry"
                      aria-label="Delete entry"
                      style={{
                        color: "#94a3b8",
                        background: "transparent",
                        border: "none",
                        cursor: del.isPending ? "not-allowed" : "pointer",
                        padding: 4,
                        fontSize: 16,
                        lineHeight: 1,
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
      {showLog ? <WaterLogModal onClose={() => setShowLog(false)} /> : null}
    </>
  );
}
