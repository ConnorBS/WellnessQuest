"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { FoodRecentListSchema, type FoodRecentEntry } from "@/lib/schemas";

export function useRecentFood(limit = 6) {
  return useQuery<FoodRecentEntry[]>({
    queryKey: ["food", "recent", limit],
    queryFn: () => apiFetch(`/food/recent?limit=${limit}`, FoodRecentListSchema),
    staleTime: 60_000,
  });
}
