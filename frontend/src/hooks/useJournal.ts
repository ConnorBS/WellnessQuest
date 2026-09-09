"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  type JournalEntry,
  JournalEntryListSchema,
  JournalEntrySchema,
  JournalSummarySchema,
} from "@/lib/schemas";

export function useJournalDay(date: string) {
  return useQuery({
    queryKey: ["journal", "day", date],
    queryFn: () => apiFetch(`/journal?date=${date}`, JournalEntryListSchema),
  });
}

export function useJournalSummary(date: string) {
  return useQuery({
    queryKey: ["journal", "summary", date],
    queryFn: () => apiFetch(`/journal/summary?date=${date}`, JournalSummarySchema),
  });
}

export function useJournalRecent(limit = 50) {
  return useQuery({
    queryKey: ["journal", "recent", limit],
    queryFn: () => apiFetch(`/journal/recent?limit=${limit}`, JournalEntryListSchema),
  });
}

export function useAddJournalEntry() {
  const qc = useQueryClient();
  return useMutation<JournalEntry, Error, { entry_date: string; body: string }>({
    mutationFn: (args) => apiPost("/journal", JournalEntrySchema, args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });
}

export function useUpdateJournalEntry() {
  const qc = useQueryClient();
  return useMutation<
    JournalEntry,
    Error,
    { id: number; patch: { body?: string; entry_date?: string } }
  >({
    mutationFn: ({ id, patch }) =>
      apiPatch(`/journal/${id}`, JournalEntrySchema, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/journal/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });
}
