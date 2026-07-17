"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  type MoodEntry,
  MoodEntryListSchema,
  MoodEntrySchema,
  MoodSummarySchema,
  type MoodValue,
} from "@/lib/schemas";

export function useMoodSummary() {
  return useQuery({
    queryKey: ["mood", "summary"],
    queryFn: () => apiFetch("/mood/summary", MoodSummarySchema),
  });
}

export function useMoodHistory(limit = 90) {
  return useQuery({
    queryKey: ["mood", "history", limit],
    queryFn: () => apiFetch(`/mood?limit=${limit}`, MoodEntryListSchema),
  });
}

interface AddArgs {
  mood: MoodValue;
  energy: number;
  occurred_at?: string;
  note?: string | null;
}

export function useAddMood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: AddArgs) => apiPost("/mood", MoodEntrySchema, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mood"] });
    },
  });
}

export type UpdateMoodArgs = {
  id: number;
  patch: {
    mood?: MoodValue;
    energy?: number;
    occurred_at?: string;
    note?: string | null;
  };
};

export function useUpdateMood() {
  const qc = useQueryClient();
  return useMutation<MoodEntry, Error, UpdateMoodArgs>({
    mutationFn: ({ id, patch }) => apiPatch(`/mood/${id}`, MoodEntrySchema, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mood"] });
    },
  });
}

export function useDeleteMood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/mood/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mood"] });
    },
  });
}
