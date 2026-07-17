"use client";

import { REGIONS, type BodyView } from "@/lib/bodyMap";

interface Props {
  selected: string[];
  onToggle: (key: string) => void;
}

const ACCENT = "#ef4444";

export function BodyMap({ selected, onToggle }: Props) {
  const views: BodyView[] = ["front", "back"];
  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
      {views.map((view) => (
        <figure key={view} style={{ margin: 0, textAlign: "center" }}>
          <svg
            viewBox="0 0 100 185"
            style={{ width: 130, maxWidth: "40vw", height: "auto" }}
            role="group"
            aria-label={`${view} body map`}
          >
            {REGIONS.filter((r) => r.view === view).map((r) => {
              const on = selected.includes(r.key);
              const common = {
                fill: on ? ACCENT : "#1e293b",
                stroke: on ? "#fca5a5" : "#475569",
                strokeWidth: 0.8,
                style: { cursor: "pointer" },
                onClick: () => onToggle(r.key),
              };
              return r.shape.kind === "ellipse" ? (
                <ellipse
                  key={r.key}
                  cx={r.shape.cx}
                  cy={r.shape.cy}
                  rx={r.shape.rx}
                  ry={r.shape.ry}
                  {...common}
                >
                  <title>{r.label}</title>
                </ellipse>
              ) : (
                <rect
                  key={r.key}
                  x={r.shape.x}
                  y={r.shape.y}
                  width={r.shape.w}
                  height={r.shape.h}
                  rx={2}
                  {...common}
                >
                  <title>{r.label}</title>
                </rect>
              );
            })}
          </svg>
          <figcaption style={{ color: "#94a3b8", fontSize: 11, textTransform: "capitalize" }}>
            {view}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
