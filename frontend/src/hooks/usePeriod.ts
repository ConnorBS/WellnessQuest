"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPost } from "@/lib/api";
import {
  type FlowValue,
  type PeriodEntry,
  PeriodEntryListSchema,
  PeriodEntrySchema,
  type PeriodSymptom,
} from "@/lib/schemas";

export function usePeriodHistory(days = 180) {
  return useQuery({
    queryKey: ["period", "history", days],
    queryFn: () => apiFetch(`/period?days=${days}`, PeriodEntryListSchema),
  });
}

interface UpsertArgs {
  entry_date: string;
  flow: FlowValue;
  symptoms: PeriodSymptom[];
  note?: string | null;
}

export function useUpsertPeriod() {
  const qc = useQueryClient();
  return useMutation<PeriodEntry, Error, UpsertArgs>({
    mutationFn: (args) => apiPost("/period", PeriodEntrySchema, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period"] });
    },
  });
}

export function useDeletePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/period/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period"] });
    },
  });
}
