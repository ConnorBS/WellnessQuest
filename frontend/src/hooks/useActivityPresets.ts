"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  ActivityPresetListSchema,
  ActivityPresetSchema,
  type ActivityPreset,
} from "@/lib/schemas";

type PresetInput = Omit<ActivityPreset, "id">;

export function useActivityPresets() {
  return useQuery({
    queryKey: ["activity-presets"],
    queryFn: () => apiFetch("/activity/presets", ActivityPresetListSchema),
  });
}

export function useCreateActivityPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PresetInput) =>
      apiPost("/activity/presets", ActivityPresetSchema, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-presets"] }),
  });
}

export function useUpdateActivityPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ActivityPreset) =>
      apiPatch(`/activity/presets/${id}`, ActivityPresetSchema, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-presets"] }),
  });
}

export function useDeleteActivityPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/activity/presets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-presets"] }),
  });
}
