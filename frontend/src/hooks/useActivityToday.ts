"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { ActivityToday, ActivityTodaySchema } from "@/lib/schemas";

export function useActivityToday() {
  return useQuery<ActivityToday>({
    queryKey: ["activity", "today"],
    queryFn: () => apiFetch("/activity/today", ActivityTodaySchema),
  });
}
