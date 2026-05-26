"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { useViewedDay } from "@/lib/day-context";
import { occurredAtFor } from "@/lib/occurredAt";
import {
  ActivityAddOut,
  ActivityAddOutSchema,
  ActivityEntry,
  ActivityEntrySchema,
  ActivityToday,
} from "@/lib/schemas";

type AddArgs = {
  minutes: number;
  client_id: string;
  exercise_type?: string | null;
  name?: string | null;
  occurred_at?: string | null;
};

export function useAddActivity() {
  const qc = useQueryClient();
  const { viewedDay, isToday } = useViewedDay();
  const key = ["activity", "today", viewedDay] as const;
  return useMutation<ActivityAddOut, Error, AddArgs>({
    mutationFn: (args) =>
      apiPost("/move", ActivityAddOutSchema, {
        minutes: args.minutes,
        client_id: args.client_id,
        exercise_type: args.exercise_type ?? null,
        name: args.name ?? null,
        occurred_at: args.occurred_at ?? occurredAtFor(viewedDay, isToday),
      }),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ActivityToday>(key);
      if (previous) {
        const goal_minutes = previous.goal_minutes;
        const total_minutes = previous.total_minutes + args.minutes;
        qc.setQueryData<ActivityToday>(key, {
          ...previous,
          total_minutes,
          percent: goal_minutes
            ? Math.min(100, Math.round((total_minutes / goal_minutes) * 100))
            : 0,
          entries: [
            {
              id: -1,
              minutes: args.minutes,
              source: "pwa",
              occurred_at: args.occurred_at ?? occurredAtFor(viewedDay, isToday),
              client_id: args.client_id,
              exercise_type: args.exercise_type ?? null,
              name: args.name ?? null,
            },
            ...previous.entries,
          ],
        });
      }
      return { previous };
    },
    onError: (_err, _args, ctx) => {
      const previous = (ctx as { previous?: ActivityToday } | undefined)?.previous;
      if (previous) qc.setQueryData(key, previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["activity", "today", viewedDay] });
      qc.invalidateQueries({ queryKey: ["activity", "recent"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  const { viewedDay } = useViewedDay();
  return useMutation<void, Error, number>({
    mutationFn: (entry_id) => apiDelete(`/move/${entry_id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity", "today", viewedDay] });
      qc.invalidateQueries({ queryKey: ["activity", "recent"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export type UpdateActivityArgs = {
  id: number;
  patch: {
    minutes?: number;
    occurred_at?: string;
    exercise_type?: string | null;
    name?: string | null;
  };
};

export function useUpdateActivity() {
  const qc = useQueryClient();
  const { viewedDay } = useViewedDay();
  return useMutation<ActivityEntry, Error, UpdateActivityArgs>({
    mutationFn: ({ id, patch }) =>
      apiPatch(`/move/${id}`, ActivityEntrySchema, patch),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["activity", "today", viewedDay] });
      qc.invalidateQueries({ queryKey: ["activity", "recent"] });
    },
  });
}
