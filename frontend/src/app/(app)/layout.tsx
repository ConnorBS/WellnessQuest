"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { DayHeader } from "@/components/DayHeader";
import { useSwipe } from "@/hooks/useSwipe";
import { clearTokens, isLoggedIn } from "@/lib/auth";
import { DayProvider, useViewedDay } from "@/lib/day-context";

const PATHS_WITH_DAY_HEADER = ["/dashboard", "/water", "/food", "/activity", "/habits"];

function shouldShowDayHeader(pathname: string | null): boolean {
  if (!pathname) return false;
  return PATHS_WITH_DAY_HEADER.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function MainBody({ pathname, children }: { pathname: string | null; children: React.ReactNode }) {
  const { goToPrev, goToNext } = useViewedDay();
  const showDayHeader = shouldShowDayHeader(pathname);
  const swipe = useSwipe({
    onSwipeRight: showDayHeader ? goToPrev : undefined,
    onSwipeLeft: showDayHeader ? goToNext : undefined,
  });

  return (
    <main
      {...(showDayHeader ? swipe : {})}
      style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 16 }}
    >
      {showDayHeader && <DayHeader />}
      {children}
    </main>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoggedIn()) router.replace("/login");
  }, [router]);

  function onLogout() {
    clearTokens();
    router.replace("/login");
  }

  return (
    <DayProvider>
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
            <Link href="/food">Food</Link>
            <Link href="/activity">Activity</Link>
            <Link href="/habits">Habits</Link>
            <Link href="/weight">Weight</Link>
            <Link href="/settings">Settings</Link>
            <button onClick={onLogout} style={{ color: "#94a3b8" }}>
              Sign out
            </button>
          </nav>
        </header>
        <MainBody pathname={pathname}>{children}</MainBody>
      </div>
    </DayProvider>
  );
}
