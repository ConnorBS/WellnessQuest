"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPost } from "@/lib/api";
import {
  BloodPressureEntryListSchema,
  BloodPressureEntrySchema,
  BloodPressureSummarySchema,
} from "@/lib/schemas";

export function useBPSummary() {
  return useQuery({
    queryKey: ["bp", "summary"],
    queryFn: () => apiFetch("/blood-pressure/summary", BloodPressureSummarySchema),
  });
}

export function useBPHistory(limit = 90) {
  return useQuery({
    queryKey: ["bp", "history", limit],
    queryFn: () =>
      apiFetch(`/blood-pressure?limit=${limit}`, BloodPressureEntryListSchema),
  });
}

interface AddArgs {
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  occurred_at?: string;
  note?: string | null;
}

export function useAddBP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: AddArgs) =>
      apiPost("/blood-pressure", BloodPressureEntrySchema, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bp"] });
    },
  });
}

export function useDeleteBP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/blood-pressure/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bp"] });
    },
  });
}
