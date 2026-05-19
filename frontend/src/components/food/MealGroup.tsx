"use client";

import { useState } from "react";

import { EditFoodEntryDrawer } from "@/components/food/EditFoodEntryDrawer";
import { useDeleteFood } from "@/hooks/useAddFood";
import type { FoodEntry, MealType } from "@/lib/schemas";

const MEAL_LABELS: Record<MealType | "unsorted", string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
  unsorted: "Other",
};

const MEAL_ORDER: (MealType | "unsorted")[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "unsorted",
];

function bucketKey(e: FoodEntry): MealType | "unsorted" {
  return e.meal_type ?? "unsorted";
}

export function MealGroups({ entries }: { entries: FoodEntry[] }) {
  const del = useDeleteFood();
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const buckets = new Map<MealType | "unsorted", FoodEntry[]>();
  for (const e of entries) {
    const k = bucketKey(e);
    const arr = buckets.get(k) ?? [];
    arr.push(e);
    buckets.set(k, arr);
  }

  const presentKeys = MEAL_ORDER.filter((k) => buckets.has(k));
  if (presentKeys.length === 0) {
    return <p className="text-slate-400 text-sm">No entries yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {presentKeys.map((k) => {
        const items = buckets.get(k) ?? [];
        const subtotal = items.reduce((sum, e) => sum + e.kcal, 0);
        return (
          <div key={k}>
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 6,
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#cbd5e1" }}>
                {MEAL_LABELS[k]}
              </h3>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{subtotal} kcal</span>
            </header>
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
              {items.map((e) => {
                const editable = e.id > 0; // optimistic entries can't be edited yet
                return (
                  <li
                    key={`${e.id}-${e.client_id ?? ""}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 14,
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: 6,
                      padding: "8px 10px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => editable && setEditing(e)}
                      disabled={!editable}
                      style={{
                        flex: 1,
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        padding: 0,
                        cursor: editable ? "pointer" : "default",
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e.name}
                        {e.brand ? (
                          <span style={{ color: "#64748b" }}> · {e.brand}</span>
                        ) : null}
                      </span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>
                        {new Date(e.occurred_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {e.servings != null
                          ? ` · ${fmtServings(e.servings)} serving${e.servings === 1 ? "" : "s"}`
                          : null}
                        {e.protein_g != null || e.carbs_g != null || e.fat_g != null ? (
                          <>
                            {" · "}
                            P {fmtMacro(e.protein_g)} · C {fmtMacro(e.carbs_g)} · F{" "}
                            {fmtMacro(e.fat_g)}
                          </>
                        ) : null}
                      </span>
                    </button>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>{e.kcal} kcal</span>
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => del.mutate(e.id)}
                          disabled={del.isPending}
                          title="Delete entry"
                          style={{
                            color: "#94a3b8",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: 4,
                          }}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {editing ? (
        <EditFoodEntryDrawer entry={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function fmtMacro(v: number | null | undefined): string {
  if (v == null) return "—";
  return v >= 10 ? `${Math.round(v)}g` : `${v.toFixed(1)}g`;
}

function fmtServings(s: number): string {
  if (Number.isInteger(s)) return String(s);
  return s.toFixed(2).replace(/\.?0+$/, "");
}
