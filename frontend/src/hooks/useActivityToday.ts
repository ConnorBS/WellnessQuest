"use client";

import { useQuery } from "@tanstack/react-query";

import { useViewedDay } from "@/lib/day-context";
import { apiFetch } from "@/lib/api";
import { ActivityToday, ActivityTodaySchema } from "@/lib/schemas";

export function useActivityToday() {
  const { viewedDay, isToday } = useViewedDay();
  return useQuery<ActivityToday>({
    queryKey: ["activity", "today", viewedDay],
    queryFn: () =>
      apiFetch(
        isToday ? "/move/today" : `/move/today?date=${viewedDay}`,
        ActivityTodaySchema,
      ),
  });
}
