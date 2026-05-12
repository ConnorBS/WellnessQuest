"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { loadMdi } from "@/lib/mdi";
import { makeQueryClient } from "@/lib/queryClient";
import { registerServiceWorker } from "@/lib/sw-register";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => makeQueryClient());
  useEffect(() => {
    registerServiceWorker();
    // Warm the MDI icon catalog so app-wide icons (preset buttons, habit rows)
    // render synchronously after the first paint instead of flashing the
    // fallback circle. ~3MB chunk, browser-cached after first fetch.
    loadMdi().catch(() => {
      /* network blip — MdiIcon renders fallback circles until the next attempt */
    });
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
