"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { loadMdi } from "@/lib/mdi";
import { makeQueryClient } from "@/lib/queryClient";
import { registerServiceWorker } from "@/lib/sw-register";
import { applyCachedTheme } from "@/lib/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => makeQueryClient());
  useEffect(() => {
    // Last-known palette first so a themed user doesn't see the default dark
    // page flash before /me answers; the app layout re-applies the real one.
    applyCachedTheme();
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
