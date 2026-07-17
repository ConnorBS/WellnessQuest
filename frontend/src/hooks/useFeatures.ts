"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, apiPatch } from "@/lib/api";
import { FeaturesResponseSchema } from "@/lib/schemas";
import { useMe } from "@/hooks/useMe";

/**
 * Read the effective feature map from the already-loaded /me payload (no extra
 * request). `isEnabled` defaults unknown keys to true so the app fails open.
 */
export function useFeatures() {
  const { data: me } = useMe();
  const features = me?.features ?? {};
  return {
    features,
    isEnabled: (key: string) => features[key] ?? true,
  };
}

/** Full feature list with labels — for the Settings → Trackers control page. */
export function useFeatureList() {
  return useQuery({
    queryKey: ["features"],
    queryFn: () => apiFetch("/features", FeaturesResponseSchema),
  });
}

export function useToggleFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      apiPatch("/features", FeaturesResponseSchema, {
        feature_key: key,
        enabled,
      }),
    onSuccess: (data) => {
      qc.setQueryData(["features"], data);
      // /me carries the features map that gates nav + dashboard cards.
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
