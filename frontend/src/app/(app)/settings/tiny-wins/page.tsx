"use client";

import { useState } from "react";

import {
  useAddTinyWin,
  useArchiveTinyWin,
  useRenameTinyWin,
  useReorderTinyWins,
  useTinyWins,
} from "@/hooks/useTinyWins";
import { todayLocalIso } from "@/lib/day-context";

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "var(--wq-accent)",
  color: "var(--wq-on-accent)",
  border: 0,
  borderRadius: 6,
  fontWeight: 500,
};

const subtleBtn: React.CSSProperties = {
  padding: "4px 8px",
  background: "transparent",
  color: "var(--wq-text-2)",
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
  fontSize: 12,
};

const dangerBtn: React.CSSProperties = {
  padding: "4px 8px",
  background: "transparent",
  color: "#fca5a5",
  border: "1px solid #7f1d1d",
  borderRadius: 6,
  fontSize: 12,
};

export default function TinyWinsSettingsPage() {
  const list = useTinyWins(todayLocalIso());
  const add = useAddTinyWin();
  const rename = useRenameTinyWin();
  const archive = useArchiveTinyWin();
  const reorder = useReorderTinyWins();
  const [newLabel, setNewLabel] = useState("");

  const items = list.data ?? [];

  function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    reorder.mutate(next.map((i) => i.id));
  }

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Tiny wins list
        </h2>
        <p style={{ color: "var(--wq-muted)", fontSize: 13, marginBottom: 12 }}>
          These self-care items appear on your daily Tiny wins checklist. Make them yours —
          rename, remove, reorder, or add your own. Removing keeps past check-ins intact.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Add a tiny win"
            maxLength={120}
            style={{ flex: 1, padding: "8px" }}
          />
          <button
            type="button"
            style={primaryBtn}
            disabled={add.isPending || !newLabel.trim()}
            onClick={() => add.mutate(newLabel.trim(), { onSuccess: () => setNewLabel("") })}
          >
            Add
          </button>
        </div>

        {list.isLoading ? (
          <p style={{ color: "var(--wq-muted)" }}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ color: "var(--wq-muted)" }}>No items yet — add one above.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((it, i) => (
              <li
                key={it.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 0",
                  borderBottom: "1px solid var(--wq-surface-2)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <button type="button" style={subtleBtn} onClick={() => move(i, -1)} disabled={i === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    style={subtleBtn}
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                  >
                    ↓
                  </button>
                </div>
                <input
                  type="text"
                  defaultValue={it.label}
                  maxLength={120}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== it.label) rename.mutate({ id: it.id, label: v });
                  }}
                  style={{ flex: 1, padding: "6px 8px" }}
                />
                <button
                  type="button"
                  style={dangerBtn}
                  onClick={() => {
                    if (confirm(`Remove "${it.label}"?`)) archive.mutate(it.id);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
