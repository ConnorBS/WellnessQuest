"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost } from "@/lib/api";
import { useViewedDay } from "@/lib/day-context";
import { ActivityAddOut, ActivityAddOutSchema, ActivityToday } from "@/lib/schemas";

type AddArgs = { minutes: number; client_id: string };

function occurredAtFor(viewedDay: string, isToday: boolean): string {
  if (isToday) return new Date().toISOString();
  return new Date(`${viewedDay}T12:00:00`).toISOString();
}

export function useAddActivity() {
  const qc = useQueryClient();
  const { viewedDay, isToday } = useViewedDay();
  const key = ["activity", "today", viewedDay] as const;
  return useMutation<ActivityAddOut, Error, AddArgs>({
    mutationFn: (args) =>
      apiPost("/activity", ActivityAddOutSchema, {
        ...args,
        occurred_at: occurredAtFor(viewedDay, isToday),
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
              occurred_at: occurredAtFor(viewedDay, isToday),
              client_id: args.client_id,
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
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
