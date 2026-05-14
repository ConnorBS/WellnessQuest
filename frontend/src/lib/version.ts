import { z } from "zod";

import { apiFetch } from "@/lib/api";

export const VersionSchema = z.object({
  version: z.string(),
  git_sha: z.string().nullable(),
  build_timestamp: z.string().nullable(),
});

export type Version = z.infer<typeof VersionSchema>;

export function fetchVersion(): Promise<Version> {
  return apiFetch("/version", VersionSchema, { skipAuth: true });
}
