"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost, apiPostVoid } from "@/lib/api";
import {
  type PainEntry,
  PainEntryListSchema,
  PainEntrySchema,
  PainSummarySchema,
  type Severity,
  type SymptomCatalogItem,
  SymptomCatalogListSchema,
  SymptomCatalogSchema,
} from "@/lib/schemas";

// --- symptom catalog -------------------------------------------------------

export function useSymptomCatalog() {
  return useQuery({
    queryKey: ["pain", "catalog"],
    queryFn: () => apiFetch("/pain/symptoms", SymptomCatalogListSchema),
  });
}

export function useAddSymptom() {
  const qc = useQueryClient();
  return useMutation<SymptomCatalogItem, Error, string>({
    mutationFn: (name) => apiPost("/pain/symptoms", SymptomCatalogSchema, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pain", "catalog"] }),
  });
}

export function useRenameSymptom() {
  const qc = useQueryClient();
  return useMutation<SymptomCatalogItem, Error, { id: number; name: string }>({
    mutationFn: ({ id, name }) =>
      apiPatch(`/pain/symptoms/${id}`, SymptomCatalogSchema, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pain", "catalog"] }),
  });
}

export function useArchiveSymptom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/pain/symptoms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pain", "catalog"] }),
  });
}

export function useReorderSymptoms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => apiPostVoid("/pain/symptoms/reorder", { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pain", "catalog"] }),
  });
}

// --- pain entries ----------------------------------------------------------

export function usePainSummary() {
  return useQuery({
    queryKey: ["pain", "summary"],
    queryFn: () => apiFetch("/pain/summary", PainSummarySchema),
  });
}

export function usePainHistory(limit = 90) {
  return useQuery({
    queryKey: ["pain", "history", limit],
    queryFn: () => apiFetch(`/pain?limit=${limit}`, PainEntryListSchema),
  });
}

export interface AddPainArgs {
  pain_level: number;
  note?: string | null;
  occurred_at?: string;
  locations: string[];
  symptoms: { catalog_id: number; severity: Severity; duration_minutes?: number | null }[];
}

export function useAddPain() {
  const qc = useQueryClient();
  return useMutation<PainEntry, Error, AddPainArgs>({
    mutationFn: (args) => apiPost("/pain", PainEntrySchema, args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pain"] }),
  });
}

export function useDeletePain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/pain/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pain"] }),
  });
}
