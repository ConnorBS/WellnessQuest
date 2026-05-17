"use client";

import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status = (error as { status?: number }).status;
          if (typeof status === "number" && status >= 400 && status < 500) {
            return false;
          }
          return failureCount < 1;
        },
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
