"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppNav } from "@/components/AppNav";
import { DayHeader } from "@/components/DayHeader";
import { TitleUnlockModal } from "@/components/TitleUnlockModal";
import { VersionFooter } from "@/components/VersionFooter";
import { useSwipe } from "@/hooks/useSwipe";
import { useMe } from "@/hooks/useMe";
import { isLoggedIn } from "@/lib/auth";
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
  const { data: me, error: meError } = useMe();

  useEffect(() => {
    if (!isLoggedIn()) router.replace("/login");
  }, [router]);

  // /me failing means tokens are either gone (api.ts cleared them after a
  // failed refresh) or the backend rejected them. Either way, send the user
  // to /login instead of leaving them staring at an empty shell.
  useEffect(() => {
    if (meError) router.replace("/login");
  }, [meError, router]);

  useEffect(() => {
    if (me?.must_change_password) router.replace("/change-password");
  }, [me?.must_change_password, router]);

  if (!me) return null;

  return (
    <DayProvider>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px" }}>
        <AppNav />
        <MainBody pathname={pathname}>{children}</MainBody>
        <VersionFooter />
      </div>
      <TitleUnlockModal
        pending={me.pending_title_unlocks}
        pendingTotal={me.pending_title_unlocks_total}
      />
    </DayProvider>
  );
}
