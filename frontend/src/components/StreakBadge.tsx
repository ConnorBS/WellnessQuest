"use client";

import { useWaterToday } from "@/hooks/useWaterToday";

interface Props {
  metric: string;
}

export function StreakBadge({ metric }: Props) {
  const { data } = useWaterToday();
  // Slice 1: backend doesn't surface streak in /water/today yet; show a placeholder hint.
  const met = data ? data.total_ml >= data.goal_ml && data.goal_ml > 0 : false;
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
      {met ? "Goal met today" : "Keep going"}
    </span>
  );
}
