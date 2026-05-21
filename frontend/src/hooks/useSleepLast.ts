"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { SleepLast, SleepLastSchema } from "@/lib/schemas";

export function useSleepLast() {
  return useQuery<SleepLast>({
    queryKey: ["sleep", "last"],
    queryFn: () => apiFetch("/sleep/last", SleepLastSchema),
  });
}
