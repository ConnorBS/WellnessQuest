"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPost } from "@/lib/api";
import {
  SleepAddOut,
  SleepAddOutSchema,
  SleepEntry,
  SleepListSchema,
} from "@/lib/schemas";

type AddArgs = {
  started_at: string;
  ended_at: string;
  quality_score?: number | null;
  client_id: string;
};

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["sleep"] });
  qc.invalidateQueries({ queryKey: ["me"] });
}

export function useAddSleep() {
  const qc = useQueryClient();
  return useMutation<SleepAddOut, Error, AddArgs>({
    mutationFn: (args) =>
      apiPost("/sleep", SleepAddOutSchema, {
        started_at: args.started_at,
        ended_at: args.ended_at,
        quality_score: args.quality_score ?? null,
        client_id: args.client_id,
      }),
    onSettled: () => invalidate(qc),
  });
}

export function useDeleteSleep() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (entry_id) => apiDelete(`/sleep/${entry_id}`),
    onSuccess: () => invalidate(qc),
  });
}

export function useSleepRecent(limit = 14) {
  // Not day-scoped — the history list reads the same from any day.
  return useQuery<SleepEntry[]>({
    queryKey: ["sleep", "recent", limit],
    queryFn: () => apiFetch(`/sleep/recent?limit=${limit}`, SleepListSchema),
  });
}
