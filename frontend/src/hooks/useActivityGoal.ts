"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPatch } from "@/lib/api";
import { ActivityGoalOutSchema } from "@/lib/schemas";

export function useUpdateActivityGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target_minutes: number) =>
      apiPatch("/move/goal", ActivityGoalOutSchema, { target_minutes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity", "today"] });
    },
  });
}
