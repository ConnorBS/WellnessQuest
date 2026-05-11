"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { Me, MeSchema } from "@/lib/schemas";

export function useMe() {
  return useQuery<Me>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/me", MeSchema),
  });
}
