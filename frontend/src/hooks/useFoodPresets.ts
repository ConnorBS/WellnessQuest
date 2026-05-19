"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  FoodPresetListSchema,
  FoodPresetSchema,
  type FoodPreset,
  type NutrientPanel,
} from "@/lib/schemas";

// The server's `FoodPreset.nutrients` is a non-null `Record<string, number>` —
// it strips nulls before persisting. On the INPUT side we accept both the
// stored shape AND the editable `NutrientPanel` (nullable fields) so the
// preset form and the OFF-derived flow can share one mutation.
type PresetInput = Omit<FoodPreset, "id" | "nutrients"> & {
  nutrients?: NutrientPanel | Record<string, number> | null;
};

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
    mutationFn: ({ id, ...input }: { id: string } & PresetInput) =>
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
