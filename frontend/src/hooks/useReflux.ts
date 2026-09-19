"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  type RefluxEntry,
  RefluxEntryListSchema,
  RefluxEntrySchema,
  type RefluxSeverity,
  RefluxSummarySchema,
  type RefluxTrigger,
} from "@/lib/schemas";

export function useRefluxSummary() {
  return useQuery({
    queryKey: ["reflux", "summary"],
    queryFn: () => apiFetch("/reflux/summary", RefluxSummarySchema),
  });
}

export function useRefluxHistory(limit = 90) {
  return useQuery({
    queryKey: ["reflux", "history", limit],
    queryFn: () => apiFetch(`/reflux?limit=${limit}`, RefluxEntryListSchema),
  });
}

interface AddArgs {
  severity: RefluxSeverity;
  triggers: RefluxTrigger[];
  occurred_at?: string;
  note?: string | null;
}

export function useAddReflux() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: AddArgs) => apiPost("/reflux", RefluxEntrySchema, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reflux"] });
    },
  });
}

export type UpdateRefluxArgs = {
  id: number;
  patch: Partial<AddArgs>;
};

export function useUpdateReflux() {
  const qc = useQueryClient();
  return useMutation<RefluxEntry, Error, UpdateRefluxArgs>({
    mutationFn: ({ id, patch }) => apiPatch(`/reflux/${id}`, RefluxEntrySchema, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reflux"] });
    },
  });
}

export function useDeleteReflux() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/reflux/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reflux"] });
    },
  });
}
