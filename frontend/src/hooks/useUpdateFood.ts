"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPatch } from "@/lib/api";
import { useViewedDay } from "@/lib/day-context";
import {
  type FoodPatchOut,
  FoodPatchOutSchema,
  type MealType,
  type NutrientPanel,
} from "@/lib/schemas";

export type UpdateFoodArgs = {
  id: number;
  patch: {
    name?: string;
    brand?: string | null;
    kcal?: number;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
    servings?: number | null;
    serving_g?: number | null;
    serving_label?: string | null;
    nutrients?: NutrientPanel | null;
    meal_type?: MealType | null;
    occurred_at?: string;
  };
};

export function useUpdateFood() {
  const qc = useQueryClient();
  const { viewedDay } = useViewedDay();
  return useMutation<FoodPatchOut, Error, UpdateFoodArgs>({
    mutationFn: ({ id, patch }) =>
      apiPatch(`/food/${id}`, FoodPatchOutSchema, patch),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["food", "today", viewedDay] });
      qc.invalidateQueries({ queryKey: ["food", "recent"] });
    },
  });
}
