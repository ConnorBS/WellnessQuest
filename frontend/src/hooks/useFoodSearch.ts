"use client";

import { useCallback, useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { FoodSearch, FoodSearchSchema } from "@/lib/schemas";

// Wait this long after the last keystroke before firing /food/search.
// OFF is slow (~1-8s per request) and prone to ReadTimeout under load —
// hitting it on every keystroke creates a pile of in-flight requests
// whose late failures clobber the visible result.
const DEFAULT_DEBOUNCE_MS = 300;

export function useFoodSearch(
  query: string,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    if (debouncedQuery === query) return;
    const handle = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(handle);
  }, [query, debounceMs, debouncedQuery]);

  const trimmed = debouncedQuery.trim();
  const result = useQuery<FoodSearch>({
    queryKey: ["food", "search", trimmed],
    queryFn: () =>
      apiFetch(`/food/search?q=${encodeURIComponent(trimmed)}`, FoodSearchSchema),
    enabled: enabled && trimmed.length >= 2,
    staleTime: 60_000,
  });

  // Skip the debounce window and search for whatever's currently typed
  // (Enter key, "Retry" button). Without this, the user can press Retry
  // before the debounce ticks and end up re-fetching the old query.
  const flushAndRefetch = useCallback(() => {
    setDebouncedQuery(query);
    return result.refetch();
  }, [query, result]);

  return { ...result, flushAndRefetch };
}
