"use client";

import { useMutation } from "@tanstack/react-query";

import { apiUpload } from "@/lib/api";
import { UploadOutSchema } from "@/lib/schemas";

export function useUploadIcon() {
  return useMutation({
    mutationFn: (file: File) => apiUpload("/uploads/icons", UploadOutSchema, file),
  });
}
