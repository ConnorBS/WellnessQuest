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
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid #1e293b" }}>
        <Link href="/dashboard" style={{ fontWeight: 600 }}>
          WellnessQuest
        </Link>
        <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/water">Water</Link>
          <Link href="/settings">Settings</Link>
          <button onClick={onLogout} style={{ background: "transparent", color: "#94a3b8", border: 0 }}>
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
