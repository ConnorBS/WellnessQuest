"use client";

import { useEffect, useMemo, useState } from "react";

import { MdiIcon } from "@/components/icons/MdiIcon";

type MdiMetaEntry = {
  name: string;
  aliases?: string[];
  tags?: string[];
  deprecated?: boolean;
};

const MAX_RESULTS = 120;

const POPULAR: string[] = [
  "water",
  "cup",
  "cup-water",
  "bottle-soda",
  "coffee",
  "tea",
  "food-apple",
  "food",
  "walk",
  "run",
  "bike",
  "swim",
  "dumbbell",
  "yoga",
  "weight-lifter",
  "heart-pulse",
  "human-handsup",
  "meditation",
  "sleep",
  "alarm",
  "book-open-page-variant",
  "pencil",
  "broom",
  "pill",
  "leaf",
  "cash",
  "music",
  "headphones",
  "laptop",
  "phone",
  "calendar-check",
  "star",
  "heart",
];

interface Props {
  value: string | null;
  onChange: (name: string) => void;
}

export function IconPicker({ value, onChange }: Props) {
  const [meta, setMeta] = useState<MdiMetaEntry[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    import("@mdi/svg/meta.json").then((m) => {
      if (cancelled) return;
      const all = (m.default ?? m) as MdiMetaEntry[];
      setMeta(all.filter((e) => !e.deprecated));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!meta) return null;
    if (!q) {
      return POPULAR.map((name) => meta.find((e) => e.name === name))
        .filter((e): e is MdiMetaEntry => !!e);
    }
    const hits: MdiMetaEntry[] = [];
    for (const entry of meta) {
      if (hits.length >= MAX_RESULTS) break;
      if (
        entry.name.includes(q) ||
        entry.aliases?.some((a) => a.toLowerCase().includes(q)) ||
        entry.tags?.some((t) => t.toLowerCase().includes(q))
      ) {
        hits.push(entry);
      }
    }
    return hits;
  }, [meta, query]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        type="search"
        placeholder="Search 7,000+ icons — e.g. coffee, run, dumbbell"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {value && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#94a3b8", fontSize: 13 }}>
          <MdiIcon name={value} size={28} />
          <span>
            Selected: <code style={{ color: "#cbd5e1" }}>{value}</code>
          </span>
        </div>
      )}

      {!results ? (
        <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading icon catalog…</p>
      ) : results.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 13 }}>No icons match “{query}”.</p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
              gap: 6,
              maxHeight: 280,
              overflowY: "auto",
              padding: 6,
              border: "1px solid #1e293b",
              borderRadius: 8,
              background: "rgba(15, 23, 42, 0.5)",
            }}
          >
            {results.map((entry) => {
              const selected = value === entry.name;
              return (
                <button
                  key={entry.name}
                  type="button"
                  title={entry.name}
                  onClick={() => onChange(entry.name)}
                  style={{
                    aspectRatio: "1",
                    background: selected ? "#1e293b" : "transparent",
                    border: selected ? "2px solid #10b981" : "1px solid #334155",
                    borderRadius: 6,
                    color: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MdiIcon name={entry.name} size={24} />
                </button>
              );
            })}
          </div>
          {query && results.length === MAX_RESULTS && (
            <p style={{ color: "#64748b", fontSize: 12 }}>
              Showing first {MAX_RESULTS} matches — refine the search to narrow down.
            </p>
          )}
        </>
      )}
    </div>
  );
}
