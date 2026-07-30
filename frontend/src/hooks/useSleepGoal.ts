"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPatch } from "@/lib/api";
import { SleepGoalOutSchema } from "@/lib/schemas";

export function useUpdateSleepGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target_minutes: number) =>
      apiPatch("/sleep/goal", SleepGoalOutSchema, { target_minutes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sleep"] });
    },
  });
}
