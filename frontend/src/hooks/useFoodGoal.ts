"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPatch } from "@/lib/api";
import { FoodGoalOutSchema } from "@/lib/schemas";

export function useUpdateFoodGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target_kcal: number) =>
      apiPatch("/food/goal", FoodGoalOutSchema, { target_kcal }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food", "today"] });
    },
  });
}
