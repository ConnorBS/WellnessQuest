"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  type Habit,
  HabitListSchema,
  HabitSchema,
  HabitWithStatusSchema,
} from "@/lib/schemas";

type HabitInput = Omit<Habit, "id">;

export function useHabits() {
  return useQuery({
    queryKey: ["habits"],
    queryFn: () => apiFetch("/habits", HabitListSchema),
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HabitInput) => apiPost("/habits", HabitSchema, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Habit) =>
      apiPatch(`/habits/${id}`, HabitSchema, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/habits/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });
}

export function useToggleHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost(`/habits/${id}/checkins/toggle`, HabitWithStatusSchema, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });
}
