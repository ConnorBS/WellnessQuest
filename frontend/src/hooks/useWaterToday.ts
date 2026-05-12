"use client";

import { useQuery } from "@tanstack/react-query";

import { useViewedDay } from "@/lib/day-context";
import { apiFetch } from "@/lib/api";
import { WaterToday, WaterTodaySchema } from "@/lib/schemas";

export function useWaterToday() {
  const { viewedDay, isToday } = useViewedDay();
  return useQuery<WaterToday>({
    queryKey: ["water", "today", viewedDay],
    queryFn: () =>
      apiFetch(
        isToday ? "/water/today" : `/water/today?date=${viewedDay}`,
        WaterTodaySchema,
      ),
  });
}
