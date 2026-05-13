"use client";

import { useState } from "react";

import { FoodCard } from "@/components/FoodCard";
import { FoodLogModal } from "@/components/food/FoodLogModal";
import { MealGroups } from "@/components/food/MealGroup";
import { useFoodToday } from "@/hooks/useFoodToday";
import { useUpdateFoodGoal } from "@/hooks/useFoodGoal";

export default function FoodPage() {
  const { data } = useFoodToday();
  const [showLog, setShowLog] = useState(false);
  const [editTarget, setEditTarget] = useState(false);
  const updateGoal = useUpdateFoodGoal();
  const [targetDraft, setTargetDraft] = useState<number | "">("");

  function saveTarget() {
    if (targetDraft === "" || targetDraft <= 0) return;
    updateGoal.mutate(Number(targetDraft), {
      onSuccess: () => setEditTarget(false),
    });
  }

  return (
    <>
      <FoodCard />

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <h2 className="text-lg font-semibold">Today</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setTargetDraft(data?.target_kcal ?? 2000);
                setEditTarget((v) => !v);
              }}
              style={{
                background: "transparent",
                color: "#94a3b8",
                border: "1px solid #1e293b",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Edit target
            </button>
            <button
              type="button"
              onClick={() => setShowLog(true)}
              style={{
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Log food
            </button>
          </div>
        </header>

        {editTarget ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <input
              type="number"
              min={1}
              max={20000}
              value={targetDraft}
              onChange={(e) =>
                setTargetDraft(e.target.value === "" ? "" : Number(e.target.value))
              }
              style={{
                width: 120,
                padding: "6px 8px",
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: 6,
                color: "#e2e8f0",
              }}
            />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>kcal/day ceiling</span>
            <button
              type="button"
              onClick={saveTarget}
              disabled={updateGoal.isPending}
              style={{
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditTarget(false)}
              style={{
                background: "transparent",
                color: "#94a3b8",
                border: "none",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}

        <MealGroups entries={data?.entries ?? []} />
      </section>

      {showLog ? <FoodLogModal onClose={() => setShowLog(false)} /> : null}
    </>
  );
}
