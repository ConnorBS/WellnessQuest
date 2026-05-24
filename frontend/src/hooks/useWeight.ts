"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  type WeightEntry,
  WeightEntrySchema,
  WeightEntryListSchema,
  WeightSummarySchema,
  WeightTrendSeriesSchema,
} from "@/lib/schemas";

export function useWeightSummary() {
  return useQuery({
    queryKey: ["weight", "summary"],
    queryFn: () => apiFetch("/weight/summary", WeightSummarySchema),
  });
}

export function useWeightHistory(limit = 90) {
  return useQuery({
    queryKey: ["weight", "history", limit],
    queryFn: () => apiFetch(`/weight?limit=${limit}`, WeightEntryListSchema),
  });
}

export function useWeightTrend(limit = 180) {
  return useQuery({
    queryKey: ["weight", "trend", limit],
    queryFn: () => apiFetch(`/weight/trend?limit=${limit}`, WeightTrendSeriesSchema),
  });
}

interface AddArgs {
  weight_kg: number;
  occurred_at?: string;
  note?: string | null;
}

export function useAddWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: AddArgs) => apiPost("/weight", WeightEntrySchema, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight"] });
    },
  });
}

export function useDeleteWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/weight/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight"] });
    },
  });
}

export type UpdateWeightArgs = {
  id: number;
  patch: {
    weight_kg?: number;
    occurred_at?: string;
    note?: string | null;
  };
};

export function useUpdateWeight() {
  const qc = useQueryClient();
  return useMutation<WeightEntry, Error, UpdateWeightArgs>({
    mutationFn: ({ id, patch }) => apiPatch(`/weight/${id}`, WeightEntrySchema, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight"] });
    },
  });
}
