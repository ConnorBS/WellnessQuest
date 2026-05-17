"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPost } from "@/lib/api";
import {
  BloodPressureTargetListSchema,
  BloodPressureTargetSchema,
} from "@/lib/schemas";

export function useBPTargets(limit = 60) {
  return useQuery({
    queryKey: ["bp", "targets", limit],
    queryFn: () =>
      apiFetch(`/blood-pressure/targets?limit=${limit}`, BloodPressureTargetListSchema),
  });
}

interface AddTargetArgs {
  target_systolic: number | null;
  target_diastolic: number | null;
  effective_at?: string;
}

export function useAddBPTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: AddTargetArgs) =>
      apiPost("/blood-pressure/targets", BloodPressureTargetSchema, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bp"] });
    },
  });
}

export function useDeleteBPTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/blood-pressure/targets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bp"] });
    },
  });
}
