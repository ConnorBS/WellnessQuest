"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost } from "@/lib/api";
import { WaterAddOut, WaterAddOutSchema, WaterToday } from "@/lib/schemas";

type AddArgs = { ml: number; client_id: string };

export function useAddWater() {
  const qc = useQueryClient();
  return useMutation<WaterAddOut, Error, AddArgs>({
    mutationFn: (args) => apiPost("/water", WaterAddOutSchema, args),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["water", "today"] });
      const previous = qc.getQueryData<WaterToday>(["water", "today"]);
      if (previous) {
        const goal_ml = previous.goal_ml;
        const total_ml = previous.total_ml + args.ml;
        qc.setQueryData<WaterToday>(["water", "today"], {
          ...previous,
          total_ml,
          percent: goal_ml ? Math.min(100, Math.round((total_ml / goal_ml) * 100)) : 0,
          entries: [
            {
              id: -1,
              ml: args.ml,
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
      const previous = (ctx as { previous?: WaterToday } | undefined)?.previous;
      if (previous) qc.setQueryData(["water", "today"], previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["water", "today"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
