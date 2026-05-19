"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPatch } from "@/lib/api";
import { MeSchema } from "@/lib/schemas";

interface MePatch {
  show_weight_card?: boolean;
  show_bp_card?: boolean;
  weight_unit?: "kg" | "lb";
  title_hidden?: boolean;
  weight_titles_opt_out?: boolean;
  bp_titles_opt_out?: boolean;
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: MePatch) => apiPatch("/me", MeSchema, patch),
    onSuccess: (data) => {
      qc.setQueryData(["me"], data);
      qc.invalidateQueries({ queryKey: ["weight"] });
      qc.invalidateQueries({ queryKey: ["bp"] });
      qc.invalidateQueries({ queryKey: ["titles"] });
    },
  });
}
