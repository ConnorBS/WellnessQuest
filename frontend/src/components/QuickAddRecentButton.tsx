"use client";

import { useAddFood } from "@/hooks/useAddFood";
import type { FoodRecentEntry } from "@/lib/schemas";
import { uuidv4 } from "@/lib/uuid";

interface Props {
  entry: FoodRecentEntry;
}

export function QuickAddRecentButton({ entry }: Props) {
  const add = useAddFood();
  // Re-logs the recent entry with the same kcal/macros/meal it had last time.
  // Cheap, fast, and matches the "I had this yesterday too" mental model.
  return (
    <button
      type="button"
      onClick={() =>
        add.mutate({
          name: entry.name,
          brand: entry.brand ?? null,
          kcal: entry.kcal,
          protein_g: entry.protein_g ?? null,
          carbs_g: entry.carbs_g ?? null,
          fat_g: entry.fat_g ?? null,
          meal_type: entry.meal_type ?? null,
          provider: entry.provider ?? null,
          provider_id: entry.provider_id ?? null,
          client_id: uuidv4(),
        })
      }
      disabled={add.isPending}
      title={`Re-log ${entry.kcal} kcal`}
      className="wq-tap"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        padding: "6px 10px",
        border: "1px solid #1e293b",
        borderRadius: 999,
        color: "#cbd5e1",
        background: "#0f172a",
        cursor: add.isPending ? "not-allowed" : "pointer",
        opacity: add.isPending ? 0.6 : 1,
        whiteSpace: "nowrap",
        maxWidth: 220,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 200,
        }}
      >
        {entry.name}
      </span>
      <span style={{ fontSize: 11, color: "#94a3b8" }}>+{entry.kcal} kcal</span>
    </button>
  );
}
