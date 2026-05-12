"use client";

import { ActivityCard } from "@/components/ActivityCard";
import { useActivityToday } from "@/hooks/useActivityToday";

export default function ActivityPage() {
  const { data } = useActivityToday();
  return (
    <>
      <ActivityCard />
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Today
        </h2>
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
                  <span>+{e.minutes} min</span>
                  {e.exercise_type && (
                    <span style={{ color: "#7dd3fc", fontSize: 12, whiteSpace: "nowrap" }}>
                      {e.exercise_type}
                    </span>
                  )}
                </span>
                <span style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>
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
