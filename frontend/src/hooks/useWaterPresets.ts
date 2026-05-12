"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiPatch, apiPost, apiFetch } from "@/lib/api";
import {
  WaterPresetListSchema,
  WaterPresetSchema,
  type WaterPreset,
} from "@/lib/schemas";

type PresetInput = Omit<WaterPreset, "id">;

export function useWaterPresets() {
  return useQuery({
    queryKey: ["water-presets"],
    queryFn: () => apiFetch("/water/presets", WaterPresetListSchema),
  });
}

export function useCreatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PresetInput) =>
      apiPost("/water/presets", WaterPresetSchema, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water-presets"] }),
  });
}

export function useUpdatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: WaterPreset) =>
      apiPatch(`/water/presets/${id}`, WaterPresetSchema, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water-presets"] }),
  });
}

export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/water/presets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water-presets"] }),
  });
}
