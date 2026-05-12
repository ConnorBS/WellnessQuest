"use client";

import { useActivityToday } from "@/hooks/useActivityToday";
import { useWaterToday } from "@/hooks/useWaterToday";

interface Props {
  metric: string;
}

export function StreakBadge({ metric }: Props) {
  const water = useWaterToday();
  const activity = useActivityToday();

  let met = false;
  let label = "Keep going";
  if (metric === "water_ml") {
    const d = water.data;
    met = !!(d && d.goal_ml > 0 && d.total_ml >= d.goal_ml);
    label = met ? "Water goal met" : "Water — keep going";
  } else if (metric === "active_minutes") {
    const d = activity.data;
    met = !!(d && d.goal_minutes > 0 && d.total_minutes >= d.goal_minutes);
    label = met ? "Activity goal met" : "Activity — keep going";
  }

  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs " +
        (met
          ? "border-emerald-500 text-emerald-300"
          : "border-slate-600 text-slate-400")
      }
      data-testid={`streak-${metric}`}
    >
      {label}
    </span>
  );
}
