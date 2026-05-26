"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost, apiPostVoid } from "@/lib/api";
import { useViewedDay } from "@/lib/day-context";
import {
  type Habit,
  HabitListSchema,
  HabitSchema,
  HabitWithStatusSchema,
} from "@/lib/schemas";

type HabitInput = Omit<Habit, "id">;

export function useHabits() {
  const { viewedDay, isToday } = useViewedDay();
  return useQuery({
    queryKey: ["habits", viewedDay],
    queryFn: () =>
      apiFetch(isToday ? "/habits" : `/habits?date=${viewedDay}`, HabitListSchema),
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
  const { viewedDay, isToday } = useViewedDay();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost(
        isToday
          ? `/habits/${id}/checkins/toggle`
          : `/habits/${id}/checkins/toggle?date=${viewedDay}`,
        HabitWithStatusSchema,
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      // A check-in may have unlocked a title; refetch /me to surface the popup.
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useReorderHabits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => apiPostVoid("/habits/reorder", { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });
}
