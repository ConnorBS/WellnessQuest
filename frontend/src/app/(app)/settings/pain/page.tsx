"use client";

import { useState } from "react";

import {
  useAddSymptom,
  useArchiveSymptom,
  useRenameSymptom,
  useReorderSymptoms,
  useSymptomCatalog,
} from "@/hooks/usePain";

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

export default function PainSettingsPage() {
  const catalog = useSymptomCatalog();
  const addSymptom = useAddSymptom();
  const rename = useRenameSymptom();
  const archive = useArchiveSymptom();
  const reorder = useReorderSymptoms();
  const [newName, setNewName] = useState("");

  const items = catalog.data ?? [];

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
          Symptom list
        </h2>
        <p style={{ color: "var(--wq-muted)", fontSize: 13, marginBottom: 12 }}>
          These symptoms appear on the Pain &amp; symptoms check-in. Rename or remove any you
          don&apos;t use, and add your own. Removing keeps your past logs intact.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add a symptom"
            maxLength={80}
            style={{ flex: 1, padding: "8px" }}
          />
          <button
            type="button"
            style={primaryBtn}
            disabled={addSymptom.isPending || !newName.trim()}
            onClick={() =>
              addSymptom.mutate(newName.trim(), { onSuccess: () => setNewName("") })
            }
          >
            Add
          </button>
        </div>

        {catalog.isLoading ? (
          <p style={{ color: "var(--wq-muted)" }}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ color: "var(--wq-muted)" }}>No symptoms yet — add one above.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((c, i) => (
              <li
                key={c.id}
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
                  defaultValue={c.name}
                  maxLength={80}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== c.name) rename.mutate({ id: c.id, name: v });
                  }}
                  style={{ flex: 1, padding: "6px 8px" }}
                />
                <button
                  type="button"
                  style={dangerBtn}
                  onClick={() => {
                    if (confirm(`Remove "${c.name}"?`)) archive.mutate(c.id);
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
