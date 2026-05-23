"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiPost } from "@/lib/api";
import { useViewedDay } from "@/lib/day-context";
import { occurredAtFor } from "@/lib/occurredAt";
import {
  FoodAddOut,
  FoodAddOutSchema,
  FoodEntry,
  FoodToday,
  type FoodUnit,
  type MealType,
  type NutrientPanel,
} from "@/lib/schemas";

export type AddFoodArgs = {
  name: string;
  kcal: number;
  brand?: string | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  servings?: number | null;
  serving_g?: number | null;
  serving_label?: string | null;
  unit?: FoodUnit | null;
  nutrients?: NutrientPanel | null;
  meal_type?: MealType | null;
  provider?: string | null;
  provider_id?: string | null;
  client_id: string;
  occurred_at?: string | null;
};

export function useAddFood() {
  const qc = useQueryClient();
  const { viewedDay, isToday } = useViewedDay();
  const key = ["food", "today", viewedDay] as const;
  return useMutation<FoodAddOut, Error, AddFoodArgs>({
    mutationFn: (args) =>
      apiPost("/food", FoodAddOutSchema, {
        ...args,
        occurred_at: args.occurred_at ?? occurredAtFor(viewedDay, isToday),
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
          servings: args.servings ?? null,
          serving_g: args.serving_g ?? null,
          serving_label: args.serving_label ?? null,
          unit: args.unit ?? null,
          nutrients: stripNullsFromNutrients(args.nutrients),
          meal_type: args.meal_type ?? null,
          source: "pwa",
          provider: args.provider ?? null,
          provider_id: args.provider_id ?? null,
          occurred_at: args.occurred_at ?? occurredAtFor(viewedDay, isToday),
          client_id: args.client_id,
        };
        const mergedNutrientsTotal = mergeNutrientTotals(
          previous.nutrients_total,
          optimistic.nutrients ?? null,
        );
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
          nutrients_total: mergedNutrientsTotal,
          // Don't recompute dv_percent client-side — the server-truth lands
          // on settle. Leaving the previous values briefly is fine because
          // the optimistic delta is small relative to the day total.
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

function stripNullsFromNutrients(
  n: NutrientPanel | null | undefined,
): Record<string, number> | null {
  if (!n) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(n)) {
    if (v != null) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function mergeNutrientTotals(
  base: Record<string, number>,
  add: Record<string, number> | null,
): Record<string, number> {
  if (!add) return base;
  const out: Record<string, number> = { ...base };
  for (const [k, v] of Object.entries(add)) {
    out[k] = (out[k] ?? 0) + v;
  }
  return out;
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
