"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { useViewedDay } from "@/lib/day-context";
import { SleepLast, SleepLastSchema } from "@/lib/schemas";

export function useSleepLast() {
  // On today, show the most recent session whenever it was — a user who hasn't
  // logged last night yet should still see the night before, not an empty card.
  // On a past day, scope to sessions that ended on that day.
  const { viewedDay, isToday } = useViewedDay();
  return useQuery<SleepLast>({
    queryKey: ["sleep", "last", isToday ? "latest" : viewedDay],
    queryFn: () =>
      apiFetch(isToday ? "/sleep/last" : `/sleep/last?date=${viewedDay}`, SleepLastSchema),
  });
}
