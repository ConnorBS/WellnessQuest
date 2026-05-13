"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { WaterRecentListSchema, type WaterRecentEntry } from "@/lib/schemas";

export function useRecentWater(limit = 8) {
  return useQuery<WaterRecentEntry[]>({
    queryKey: ["water", "recent", limit],
    queryFn: () => apiFetch(`/water/recent?limit=${limit}`, WaterRecentListSchema),
    staleTime: 60_000,
  });
}
