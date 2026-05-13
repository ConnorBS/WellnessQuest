"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { SetupStatusSchema } from "@/lib/schemas";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    apiFetch("/setup/status", SetupStatusSchema, { skipAuth: true })
      .then((s) => {
        if (cancelled) return;
        if (s.setup_required) router.replace("/setup");
        else router.replace(isLoggedIn() ? "/dashboard" : "/login");
      })
      .catch(() => {
        if (!cancelled) router.replace(isLoggedIn() ? "/dashboard" : "/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);
  return null;
}
