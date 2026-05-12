"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost } from "@/lib/api";
import { ActivityAddOut, ActivityAddOutSchema, ActivityToday } from "@/lib/schemas";

type AddArgs = { minutes: number; client_id: string };

export function useAddActivity() {
  const qc = useQueryClient();
  return useMutation<ActivityAddOut, Error, AddArgs>({
    mutationFn: (args) => apiPost("/activity", ActivityAddOutSchema, args),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["activity", "today"] });
      const previous = qc.getQueryData<ActivityToday>(["activity", "today"]);
      if (previous) {
        const goal_minutes = previous.goal_minutes;
        const total_minutes = previous.total_minutes + args.minutes;
        qc.setQueryData<ActivityToday>(["activity", "today"], {
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
              occurred_at: new Date().toISOString(),
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
      if (previous) qc.setQueryData(["activity", "today"], previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["activity", "today"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
