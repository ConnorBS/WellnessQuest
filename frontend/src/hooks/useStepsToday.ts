"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { useViewedDay } from "@/lib/day-context";
import { StepsToday, StepsTodaySchema } from "@/lib/schemas";

export function useStepsToday() {
  const { viewedDay, isToday } = useViewedDay();
  return useQuery<StepsToday>({
    queryKey: ["steps", "today", viewedDay],
    queryFn: () =>
      apiFetch(
        isToday ? "/steps/today" : `/steps/today?date=${viewedDay}`,
        StepsTodaySchema,
      ),
  });
}
