"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiPost } from "@/lib/api";
import { useViewedDay } from "@/lib/day-context";
import { occurredAtFor } from "@/lib/occurredAt";
import { StepsAddOut, StepsAddOutSchema, StepsToday } from "@/lib/schemas";

type AddArgs = {
  count: number;
  client_id: string;
  occurred_at?: string | null;
};

export function useAddSteps() {
  const qc = useQueryClient();
  const { viewedDay, isToday } = useViewedDay();
  const key = ["steps", "today", viewedDay] as const;
  return useMutation<StepsAddOut, Error, AddArgs>({
    mutationFn: (args) =>
      apiPost("/steps", StepsAddOutSchema, {
        count: args.count,
        client_id: args.client_id,
        occurred_at: args.occurred_at ?? occurredAtFor(viewedDay, isToday),
      }),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<StepsToday>(key);
      if (previous) {
        const total = previous.total + args.count;
        qc.setQueryData<StepsToday>(key, {
          ...previous,
          total,
          percent: previous.goal
            ? Math.min(100, Math.round((total / previous.goal) * 100))
            : 0,
          entries: [
            {
              id: -1,
              count: args.count,
              source: "pwa",
              occurred_at: args.occurred_at ?? occurredAtFor(viewedDay, isToday),
              client_id: args.client_id,
            },
            ...previous.entries,
          ],
        });
      }
      return { previous };
    },
    onError: (_err, _args, ctx) => {
      const previous = (ctx as { previous?: StepsToday } | undefined)?.previous;
      if (previous) qc.setQueryData(key, previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["steps", "today", viewedDay] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useDeleteSteps() {
  const qc = useQueryClient();
  const { viewedDay } = useViewedDay();
  return useMutation<void, Error, number>({
    mutationFn: (entry_id) => apiDelete(`/steps/${entry_id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["steps", "today", viewedDay] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
