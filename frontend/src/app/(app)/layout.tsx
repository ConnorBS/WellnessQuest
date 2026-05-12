"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { clearTokens, isLoggedIn } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) router.replace("/login");
  }, [router]);

  function onLogout() {
    clearTokens();
    router.replace("/login");
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingBottom: 12,
          borderBottom: "1px solid #1e293b",
        }}
      >
        <Link href="/dashboard" style={{ fontWeight: 600, fontSize: 16 }}>
          WellnessQuest
        </Link>
        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            fontSize: 14,
            color: "#cbd5e1",
          }}
        >
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/water">Water</Link>
          <Link href="/activity">Activity</Link>
          <Link href="/habits">Habits</Link>
          <Link href="/settings">Settings</Link>
          <button onClick={onLogout} style={{ color: "#94a3b8" }}>
            Sign out
          </button>
        </nav>
      </header>
      <main style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </main>
    </div>
  );
}
