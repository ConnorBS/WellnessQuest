"use client";

import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { FoodSearchHit, FoodSearchHitSchema } from "@/lib/schemas";

export function useFoodBarcode() {
  return useMutation<FoodSearchHit, Error, string>({
    mutationFn: (code: string) =>
      apiFetch(`/food/barcode/${encodeURIComponent(code)}`, FoodSearchHitSchema),
  });
}
