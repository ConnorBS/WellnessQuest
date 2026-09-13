"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  type IntimacyEntry,
  IntimacyEntryListSchema,
  IntimacyEntrySchema,
  type IntimacyKind,
  IntimacySummarySchema,
  type IntimacyTag,
  type ProtectionValue,
} from "@/lib/schemas";

const BASE = "/period/intimacy";

export function useIntimacyHistory(days = 365, enabled = true) {
  return useQuery({
    queryKey: ["intimacy", "history", days],
    queryFn: () => apiFetch(`${BASE}?days=${days}`, IntimacyEntryListSchema),
    enabled,
  });
}

export function useIntimacySummary(days = 30, enabled = true) {
  return useQuery({
    queryKey: ["intimacy", "summary", days],
    queryFn: () => apiFetch(`${BASE}/summary?days=${days}`, IntimacySummarySchema),
    enabled,
  });
}

interface AddArgs {
  entry_date?: string;
  kind: IntimacyKind;
  protection: ProtectionValue;
  tags: IntimacyTag[];
  note?: string | null;
}

export function useAddIntimacy() {
  const qc = useQueryClient();
  return useMutation<IntimacyEntry, Error, AddArgs>({
    mutationFn: (args) => apiPost(BASE, IntimacyEntrySchema, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intimacy"] });
    },
  });
}

interface UpdateArgs extends Partial<AddArgs> {
  id: number;
}

export function useUpdateIntimacy() {
  const qc = useQueryClient();
  return useMutation<IntimacyEntry, Error, UpdateArgs>({
    mutationFn: ({ id, ...patch }) =>
      apiPatch(`${BASE}/${id}`, IntimacyEntrySchema, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intimacy"] });
    },
  });
}

export function useDeleteIntimacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`${BASE}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intimacy"] });
    },
  });
}
