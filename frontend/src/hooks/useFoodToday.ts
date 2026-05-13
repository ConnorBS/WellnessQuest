"use client";

import { useQuery } from "@tanstack/react-query";

import { useViewedDay } from "@/lib/day-context";
import { apiFetch } from "@/lib/api";
import { FoodToday, FoodTodaySchema } from "@/lib/schemas";

export function useFoodToday() {
  const { viewedDay, isToday } = useViewedDay();
  return useQuery<FoodToday>({
    queryKey: ["food", "today", viewedDay],
    queryFn: () =>
      apiFetch(
        isToday ? "/food/today" : `/food/today?date=${viewedDay}`,
        FoodTodaySchema,
      ),
  });
}
