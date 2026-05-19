"use client";

import { useMutation } from "@tanstack/react-query";

import { apiUpload } from "@/lib/api";
import { type LabelScanOut, LabelScanOutSchema } from "@/lib/schemas";

/**
 * Multipart POST /food/scan-label. The server returns whatever Tesseract +
 * the Canadian-Nutrition-Facts parser could extract; the UI MUST always
 * route the result through a manual review step before saving anything.
 */
export function useFoodScanLabel() {
  return useMutation<LabelScanOut, Error, File>({
    mutationFn: (file) => apiUpload("/food/scan-label", LabelScanOutSchema, file),
  });
}
