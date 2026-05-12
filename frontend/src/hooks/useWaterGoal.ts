"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPatch } from "@/lib/api";
import { WaterGoalOutSchema } from "@/lib/schemas";

export function useUpdateWaterGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target_ml: number) =>
      apiPatch("/water/goal", WaterGoalOutSchema, { target_ml }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water", "today"] });
    },
  });
}
