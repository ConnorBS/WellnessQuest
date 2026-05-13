"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  FoodPresetListSchema,
  FoodPresetSchema,
  type FoodPreset,
} from "@/lib/schemas";

type PresetInput = Omit<FoodPreset, "id">;

export function useFoodPresets() {
  return useQuery({
    queryKey: ["food-presets"],
    queryFn: () => apiFetch("/food/presets", FoodPresetListSchema),
  });
}

export function useCreateFoodPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PresetInput) =>
      apiPost("/food/presets", FoodPresetSchema, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food-presets"] }),
  });
}

export function useUpdateFoodPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: FoodPreset) =>
      apiPatch(`/food/presets/${id}`, FoodPresetSchema, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food-presets"] }),
  });
}

export function useDeleteFoodPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/food/presets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food-presets"] }),
  });
}
