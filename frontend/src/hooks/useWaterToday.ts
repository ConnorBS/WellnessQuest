"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { WaterToday, WaterTodaySchema } from "@/lib/schemas";

export function useWaterToday() {
  return useQuery<WaterToday>({
    queryKey: ["water", "today"],
    queryFn: () => apiFetch("/water/today", WaterTodaySchema),
  });
}
