"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, apiPatch, apiPostVoid } from "@/lib/api";
import {
  CategorySummary,
  CategorySummaryListSchema,
  MeSchema,
  Title,
  TitleListSchema,
} from "@/lib/schemas";

export function useTitleCategories() {
  return useQuery<CategorySummary[]>({
    queryKey: ["titles", "categories"],
    queryFn: () => apiFetch("/titles/categories", CategorySummaryListSchema),
  });
}

export type LockFilter = "all" | "unlocked" | "locked";

export function useTitlesInCategory(
  category: string | null,
  lock: LockFilter = "all",
) {
  return useQuery<Title[]>({
    queryKey: ["titles", "category", category, lock],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "500" });
      if (category != null) params.set("category", category);
      if (lock === "unlocked") params.set("unlocked", "true");
      if (lock === "locked") params.set("unlocked", "false");
      return apiFetch(`/titles?${params.toString()}`, TitleListSchema);
    },
    enabled: category != null,
  });
}

export function useUnlockedTitles() {
  return useQuery<Title[]>({
    queryKey: ["titles", "unlocked"],
    queryFn: () => apiFetch("/titles/unlocked?limit=500", TitleListSchema),
  });
}

export function useEquipTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (titleId: string | null) =>
      apiPatch("/titles/equipped", MeSchema, { title_id: titleId }),
    onSuccess: (data) => {
      qc.setQueryData(["me"], data);
      qc.invalidateQueries({ queryKey: ["titles"] });
    },
  });
}

export function useAcknowledgeTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (titleId: string) =>
      apiPostVoid(`/titles/${titleId}/acknowledge`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["titles"] });
    },
  });
}

export function useAcknowledgeAllTitles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPostVoid("/titles/acknowledge-all", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["titles"] });
    },
  });
}
