"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPatch } from "@/lib/api";
import { StepsGoalOutSchema } from "@/lib/schemas";

export function useUpdateStepsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target_steps: number) =>
      apiPatch("/steps/goal", StepsGoalOutSchema, { target_steps }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["steps", "today"] });
    },
  });
}
