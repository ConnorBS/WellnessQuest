"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  type BloodPressureEntry,
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

export type UpdateBPArgs = {
  id: number;
  patch: {
    systolic?: number;
    diastolic?: number;
    pulse?: number | null;
    occurred_at?: string;
    note?: string | null;
  };
};

export function useUpdateBP() {
  const qc = useQueryClient();
  return useMutation<BloodPressureEntry, Error, UpdateBPArgs>({
    mutationFn: ({ id, patch }) =>
      apiPatch(`/blood-pressure/${id}`, BloodPressureEntrySchema, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bp"] });
    },
  });
}

// The backend raises 400 `systolic_must_exceed_diastolic` if a patch would
// cross the invariant; surface a friendlier message in the UI.
export function bpUpdateErrorMessage(err: Error): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: string } | null;
    if (body?.detail === "systolic_must_exceed_diastolic") {
      return "Systolic must be greater than diastolic.";
    }
  }
  return "Save failed — try again.";
}
