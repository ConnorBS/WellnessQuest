"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost, apiPostVoid } from "@/lib/api";
import {
  type TinyWinItem,
  TinyWinCountListSchema,
  TinyWinItemListSchema,
  TinyWinItemSchema,
} from "@/lib/schemas";

export function useTinyWins(date: string) {
  return useQuery({
    queryKey: ["tinyWins", "day", date],
    queryFn: () => apiFetch(`/tiny-wins?date=${date}`, TinyWinItemListSchema),
  });
}

export function useTinyWinCounts(days = 30) {
  return useQuery({
    queryKey: ["tinyWins", "counts", days],
    queryFn: () => apiFetch(`/tiny-wins/counts?days=${days}`, TinyWinCountListSchema),
  });
}

export function useToggleTinyWin() {
  const qc = useQueryClient();
  return useMutation<TinyWinItem, Error, { id: number; date: string }>({
    mutationFn: ({ id, date }) =>
      apiPost(`/tiny-wins/${id}/toggle?date=${date}`, TinyWinItemSchema, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tinyWins"] }),
  });
}

export function useAddTinyWin() {
  const qc = useQueryClient();
  return useMutation<TinyWinItem, Error, string>({
    mutationFn: (label) => apiPost("/tiny-wins/items", TinyWinItemSchema, { label }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tinyWins"] }),
  });
}

export function useRenameTinyWin() {
  const qc = useQueryClient();
  return useMutation<TinyWinItem, Error, { id: number; label: string }>({
    mutationFn: ({ id, label }) =>
      apiPatch(`/tiny-wins/items/${id}`, TinyWinItemSchema, { label }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tinyWins"] }),
  });
}

export function useArchiveTinyWin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/tiny-wins/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tinyWins"] }),
  });
}

export function useReorderTinyWins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => apiPostVoid("/tiny-wins/items/reorder", { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tinyWins"] }),
  });
}
