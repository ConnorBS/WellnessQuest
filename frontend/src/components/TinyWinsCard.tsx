"use client";

import Link from "next/link";

import { useTinyWins, useToggleTinyWin } from "@/hooks/useTinyWins";
import { useViewedDay } from "@/lib/day-context";

export function TinyWinsCard() {
  const { viewedDay } = useViewedDay();
  const q = useTinyWins(viewedDay);
  const toggle = useToggleTinyWin();
  const items = q.data ?? [];
  const done = items.filter((i) => i.done).length;
  const total = items.length;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <h2 className="text-lg font-semibold">Tiny wins</h2>
        <Link href="/tiny-wins" style={{ fontSize: 13, color: "#10b981" }}>
          See all →
        </Link>
      </header>
      {q.isLoading ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : total === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          No items yet —{" "}
          <Link href="/settings/tiny-wins" style={{ color: "#10b981" }}>
            add a few
          </Link>
          .
        </p>
      ) : (
        <>
          <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>
            {done} of {total} done · every one counts 💙
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {items.slice(0, 4).map((i) => (
              <label
                key={i.id}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}
              >
                <input
                  type="checkbox"
                  checked={i.done}
                  disabled={toggle.isPending}
                  onChange={() => toggle.mutate({ id: i.id, date: viewedDay })}
                />
                <span style={{ color: i.done ? "#64748b" : "#e2e8f0", textDecoration: i.done ? "line-through" : "none" }}>
                  {i.label}
                </span>
              </label>
            ))}
            {total > 4 && (
              <Link href="/tiny-wins" style={{ color: "#10b981", fontSize: 12, marginTop: 2 }}>
                +{total - 4} more
              </Link>
            )}
          </div>
        </>
      )}
    </section>
  );
}
