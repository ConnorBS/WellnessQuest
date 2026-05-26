"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { ActivityRecentListSchema, type ActivityRecentEntry } from "@/lib/schemas";

export function useRecentActivity(limit = 8) {
  return useQuery<ActivityRecentEntry[]>({
    queryKey: ["activity", "recent", limit],
    queryFn: () => apiFetch(`/move/recent?limit=${limit}`, ActivityRecentListSchema),
    staleTime: 60_000,
  });
}
