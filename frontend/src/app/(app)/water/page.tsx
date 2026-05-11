"use client";

import { WaterCard } from "@/components/WaterCard";
import { useWaterToday } from "@/hooks/useWaterToday";

export default function WaterPage() {
  const { data } = useWaterToday();
  return (
    <>
      <WaterCard />
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Today
        </h2>
        {!data || data.entries.length === 0 ? (
          <p className="text-slate-400 text-sm">No entries yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {data.entries.map((e) => (
              <li key={`${e.id}-${e.client_id ?? ""}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span>+{e.ml} ml</span>
                <span style={{ color: "#94a3b8" }}>
                  {new Date(e.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {e.source}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
