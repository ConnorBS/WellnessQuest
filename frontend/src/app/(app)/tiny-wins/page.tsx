"use client";

import Link from "next/link";

import { useTinyWins, useToggleTinyWin } from "@/hooks/useTinyWins";
import { useViewedDay } from "@/lib/day-context";

export default function TinyWinsPage() {
  const { viewedDay, isToday } = useViewedDay();
  const q = useTinyWins(viewedDay);
  const toggle = useToggleTinyWin();
  const items = q.data ?? [];
  const done = items.filter((i) => i.done).length;
  const total = items.length;

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 4 }}>
          {isToday ? "Today's tiny wins" : "Tiny wins"}
        </h2>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>
          Some days are maintenance days, and that&apos;s okay. Invisible things still count —
          check off whatever you managed. {total > 0 ? `${done} of ${total} done.` : ""}
        </p>

        {q.isLoading ? (
          <p style={{ color: "#94a3b8" }}>Loading…</p>
        ) : total === 0 ? (
          <p style={{ color: "#94a3b8" }}>
            No items yet — add some under{" "}
            <Link href="/settings/tiny-wins" style={{ color: "#10b981" }}>
              Edit list
            </Link>
            .
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {items.map((i) => (
              <li key={i.id}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 15,
                    padding: "8px 6px",
                    borderRadius: 8,
                    background: i.done ? "#10b98111" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={i.done}
                    disabled={toggle.isPending}
                    onChange={() => toggle.mutate({ id: i.id, date: viewedDay })}
                  />
                  <span
                    style={{
                      color: i.done ? "#64748b" : "#e2e8f0",
                      textDecoration: i.done ? "line-through" : "none",
                    }}
                  >
                    {i.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {total > 0 && done === total && (
          <p style={{ color: "#34d399", fontSize: 14, marginTop: 12 }}>
            You did what you could today, and that is enough. 💙
          </p>
        )}

        <p style={{ marginTop: 16 }}>
          <Link href="/settings/tiny-wins" style={{ color: "#10b981", fontSize: 13 }}>
            Edit list
          </Link>
        </p>
      </section>
    </>
  );
}
