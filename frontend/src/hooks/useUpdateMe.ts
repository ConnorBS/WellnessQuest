"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPatch } from "@/lib/api";
import { MeSchema } from "@/lib/schemas";

interface MePatch {
  show_weight_card?: boolean;
  weight_unit?: "kg" | "lb";
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: MePatch) => apiPatch("/users/me", MeSchema, patch),
    onSuccess: (data) => {
      qc.setQueryData(["me"], data);
      qc.invalidateQueries({ queryKey: ["weight"] });
    },
  });
}
