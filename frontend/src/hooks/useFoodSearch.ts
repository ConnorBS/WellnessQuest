"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { FoodSearch, FoodSearchSchema } from "@/lib/schemas";

export function useFoodSearch(query: string, enabled = true) {
  const trimmed = query.trim();
  return useQuery<FoodSearch>({
    queryKey: ["food", "search", trimmed],
    queryFn: () =>
      apiFetch(`/food/search?q=${encodeURIComponent(trimmed)}`, FoodSearchSchema),
    enabled: enabled && trimmed.length >= 2,
    staleTime: 60_000,
  });
}
