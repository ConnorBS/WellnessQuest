"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiPost } from "@/lib/api";
import { useViewedDay } from "@/lib/day-context";
import {
  FoodAddOut,
  FoodAddOutSchema,
  FoodEntry,
  FoodToday,
  type MealType,
} from "@/lib/schemas";

export type AddFoodArgs = {
  name: string;
  kcal: number;
  brand?: string | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  meal_type?: MealType | null;
  provider?: string | null;
  provider_id?: string | null;
  client_id: string;
};

function occurredAtFor(viewedDay: string, isToday: boolean): string {
  if (isToday) return new Date().toISOString();
  return new Date(`${viewedDay}T12:00:00`).toISOString();
}

export function useAddFood() {
  const qc = useQueryClient();
  const { viewedDay, isToday } = useViewedDay();
  const key = ["food", "today", viewedDay] as const;
  return useMutation<FoodAddOut, Error, AddFoodArgs>({
    mutationFn: (args) =>
      apiPost("/food", FoodAddOutSchema, {
        ...args,
        occurred_at: occurredAtFor(viewedDay, isToday),
      }),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<FoodToday>(key);
      if (previous) {
        const total_kcal = previous.total_kcal + args.kcal;
        const target = previous.target_kcal;
        const optimistic: FoodEntry = {
          id: -Date.now(),
          name: args.name,
          brand: args.brand ?? null,
          kcal: args.kcal,
          protein_g: args.protein_g ?? null,
          carbs_g: args.carbs_g ?? null,
          fat_g: args.fat_g ?? null,
          meal_type: args.meal_type ?? null,
          source: "pwa",
          provider: args.provider ?? null,
          provider_id: args.provider_id ?? null,
          occurred_at: occurredAtFor(viewedDay, isToday),
          client_id: args.client_id,
        };
        qc.setQueryData<FoodToday>(key, {
          ...previous,
          total_kcal,
          percent: target ? Math.min(999, Math.round((total_kcal / target) * 100)) : 0,
          over_target: total_kcal > target,
          remaining_kcal: target - total_kcal,
          macros: {
            protein_g: previous.macros.protein_g + (args.protein_g ?? 0),
            carbs_g: previous.macros.carbs_g + (args.carbs_g ?? 0),
            fat_g: previous.macros.fat_g + (args.fat_g ?? 0),
          },
          entries: [optimistic, ...previous.entries],
        });
      }
      return { previous };
    },
    onError: (_err, _args, ctx) => {
      const previous = (ctx as { previous?: FoodToday } | undefined)?.previous;
      if (previous) qc.setQueryData(key, previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["food", "today", viewedDay] });
      qc.invalidateQueries({ queryKey: ["food", "recent"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useDeleteFood() {
  const qc = useQueryClient();
  const { viewedDay } = useViewedDay();
  return useMutation<void, Error, number>({
    mutationFn: (entry_id) => apiDelete(`/food/${entry_id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food", "today", viewedDay] });
      qc.invalidateQueries({ queryKey: ["food", "recent"] });
    },
  });
}
