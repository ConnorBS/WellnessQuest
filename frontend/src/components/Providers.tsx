"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { makeQueryClient } from "@/lib/queryClient";
import { registerServiceWorker } from "@/lib/sw-register";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => makeQueryClient());
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
