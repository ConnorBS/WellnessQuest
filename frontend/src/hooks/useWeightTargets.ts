"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPost } from "@/lib/api";
import { WeightTargetListSchema, WeightTargetSchema } from "@/lib/schemas";

export function useWeightTargets(limit = 90) {
  return useQuery({
    queryKey: ["weight", "targets", limit],
    queryFn: () => apiFetch(`/weight/targets?limit=${limit}`, WeightTargetListSchema),
  });
}

interface AddTargetArgs {
  target_kg: number | null;
  effective_at?: string;
}

export function useAddWeightTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: AddTargetArgs) =>
      apiPost("/weight/targets", WeightTargetSchema, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight"] });
    },
  });
}

export function useDeleteWeightTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/weight/targets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight"] });
    },
  });
}
