"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost } from "@/lib/api";
import { useViewedDay } from "@/lib/day-context";
import { WaterAddOut, WaterAddOutSchema, WaterToday } from "@/lib/schemas";

type AddArgs = { ml: number; client_id: string; name?: string | null };

function occurredAtFor(viewedDay: string, isToday: boolean): string {
  if (isToday) return new Date().toISOString();
  // Past day — anchor at local noon so the entry lands squarely on the right
  // calendar day in the user's timezone.
  return new Date(`${viewedDay}T12:00:00`).toISOString();
}

export function useAddWater() {
  const qc = useQueryClient();
  const { viewedDay, isToday } = useViewedDay();
  const key = ["water", "today", viewedDay] as const;
  return useMutation<WaterAddOut, Error, AddArgs>({
    mutationFn: (args) =>
      apiPost("/water", WaterAddOutSchema, {
        ml: args.ml,
        client_id: args.client_id,
        name: args.name ?? null,
        occurred_at: occurredAtFor(viewedDay, isToday),
      }),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<WaterToday>(key);
      if (previous) {
        const goal_ml = previous.goal_ml;
        const total_ml = previous.total_ml + args.ml;
        qc.setQueryData<WaterToday>(key, {
          ...previous,
          total_ml,
          percent: goal_ml ? Math.min(100, Math.round((total_ml / goal_ml) * 100)) : 0,
          entries: [
            {
              id: -1,
              ml: args.ml,
              source: "pwa",
              occurred_at: occurredAtFor(viewedDay, isToday),
              client_id: args.client_id,
              name: args.name ?? null,
            },
            ...previous.entries,
          ],
        });
      }
      return { previous };
    },
    onError: (_err, _args, ctx) => {
      const previous = (ctx as { previous?: WaterToday } | undefined)?.previous;
      if (previous) qc.setQueryData(key, previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["water", "today", viewedDay] });
      qc.invalidateQueries({ queryKey: ["water", "recent"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
