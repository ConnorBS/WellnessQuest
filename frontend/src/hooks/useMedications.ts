"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api";
import {
  type MedicationDetail,
  MedicationDetailSchema,
  MedicationHistoryListSchema,
  MedicationListSchema,
  MedicationOptionsSchema,
} from "@/lib/schemas";

export type MedicationStatus = "active" | "past" | "all";

export interface MedicationInput {
  name: string;
  form?: string | null;
  reason?: string | null;
  prescriber?: string | null;
  notes?: string | null;
  started_on?: string | null;
  dose_amount?: number | null;
  dose_unit?: string | null;
  frequency?: string | null;
}

export interface ChangeInput {
  kind: string;
  effective_on?: string | null;
  dose_amount?: number | null;
  dose_unit?: string | null;
  frequency?: string | null;
  note?: string | null;
}

export function useMedications(status: MedicationStatus = "all") {
  return useQuery({
    queryKey: ["medications", "list", status],
    queryFn: () => apiFetch(`/medications?status=${status}`, MedicationListSchema),
  });
}

export function useMedication(id: number) {
  return useQuery({
    queryKey: ["medications", "detail", id],
    queryFn: () => apiFetch(`/medications/${id}`, MedicationDetailSchema),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useMedicationHistory(limit = 50) {
  return useQuery({
    queryKey: ["medications", "history", limit],
    queryFn: () =>
      apiFetch(`/medications/history?limit=${limit}`, MedicationHistoryListSchema),
  });
}

// Vocabularies come from the backend so the pickers can't drift from the
// CHECK constraints. They only change on deploy — cache for the session.
export function useMedicationOptions() {
  return useQuery({
    queryKey: ["medications", "options"],
    queryFn: () => apiFetch("/medications/options", MedicationOptionsSchema),
    staleTime: Infinity,
  });
}

export function useCreateMedication() {
  const qc = useQueryClient();
  return useMutation<MedicationDetail, Error, MedicationInput>({
    mutationFn: (body) => apiPost("/medications", MedicationDetailSchema, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medications"] }),
  });
}

export function useUpdateMedication() {
  const qc = useQueryClient();
  return useMutation<
    MedicationDetail,
    Error,
    { id: number; patch: Partial<MedicationInput> }
  >({
    mutationFn: ({ id, patch }) =>
      apiPatch(`/medications/${id}`, MedicationDetailSchema, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medications"] }),
  });
}

export function useAddMedicationChange() {
  const qc = useQueryClient();
  return useMutation<MedicationDetail, Error, { id: number; change: ChangeInput }>({
    mutationFn: ({ id, change }) =>
      apiPost(`/medications/${id}/changes`, MedicationDetailSchema, change),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medications"] }),
  });
}

export function useDeleteMedicationChange() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: number; changeId: number }>({
    mutationFn: ({ id, changeId }) =>
      apiDelete(`/medications/${id}/changes/${changeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medications"] }),
  });
}

export function useStopMedication() {
  const qc = useQueryClient();
  return useMutation<
    MedicationDetail,
    Error,
    { id: number; ended_on?: string | null; reason?: string | null }
  >({
    mutationFn: ({ id, ...body }) =>
      apiPost(`/medications/${id}/stop`, MedicationDetailSchema, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medications"] }),
  });
}

export function useResumeMedication() {
  const qc = useQueryClient();
  return useMutation<MedicationDetail, Error, { id: number; note?: string | null }>({
    mutationFn: ({ id, ...body }) =>
      apiPost(`/medications/${id}/resume`, MedicationDetailSchema, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medications"] }),
  });
}

export function useDeleteMedication() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => apiDelete(`/medications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medications"] }),
  });
}
