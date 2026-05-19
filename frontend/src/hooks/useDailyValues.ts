"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { FALLBACK_DV } from "@/lib/canadianDV";
import { type DailyValues, DailyValuesSchema } from "@/lib/schemas";

/**
 * Health Canada DV reference. Cached indefinitely — these numbers are
 * regulated (Schedule K of the FDR) and only change on backend deploy.
 * Server response shape mirrors `services/canadian_dv.py`. We seed with
 * FALLBACK_DV so first paint can render bars without waiting for the
 * round-trip.
 */
export function useDailyValues(): { data: DailyValues; isLoading: boolean } {
  const q = useQuery({
    queryKey: ["food", "daily-values"],
    queryFn: () => apiFetch("/food/daily-values", DailyValuesSchema),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return { data: q.data ?? FALLBACK_DV, isLoading: q.isLoading };
}
