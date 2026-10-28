"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppNav } from "@/components/AppNav";
import { DayHeader } from "@/components/DayHeader";
import { TitleUnlockModal } from "@/components/TitleUnlockModal";
import { VersionFooter } from "@/components/VersionFooter";
import { useSwipe } from "@/hooks/useSwipe";
import { useMe } from "@/hooks/useMe";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { isLoggedIn } from "@/lib/auth";
import { DayProvider, useViewedDay } from "@/lib/day-context";
import { applyTheme, cardTintStyle } from "@/lib/theme";

const PATHS_WITH_DAY_HEADER = [
  "/dashboard",
  "/water",
  "/food",
  "/activity",
  "/steps",
  "/sleep",
  "/habits",
  "/tiny-wins",
];

function shouldShowDayHeader(pathname: string | null): boolean {
  if (!pathname) return false;
  return PATHS_WITH_DAY_HEADER.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Route prefix -> feature key, so a per-tracker card tint (Settings ->
// Appearance) also colours that tracker's own page, not just its dashboard
// card. Settings pages are deliberately left untinted.
const PATH_FEATURE: [string, string][] = [
  ["/water", "water"],
  ["/food", "food"],
  ["/activity", "activity"],
  ["/steps", "steps"],
  ["/sleep", "sleep"],
  ["/habits", "habits"],
  ["/weight", "weight"],
  ["/blood-pressure", "blood_pressure"],
  ["/mood", "mood"],
  ["/period", "period"],
  ["/pain", "pain"],
  ["/reflux", "reflux"],
  ["/medications", "medications"],
  ["/tiny-wins", "tiny_wins"],
  ["/journal", "journal"],
];

function featureForPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const hit = PATH_FEATURE.find(([p]) => pathname === p || pathname.startsWith(p + "/"));
  return hit ? hit[1] : null;
}

function MainBody({ pathname, children }: { pathname: string | null; children: React.ReactNode }) {
  const { goToPrev, goToNext } = useViewedDay();
  const { prefs, cardColor } = useUiPrefs();
  const showDayHeader = shouldShowDayHeader(pathname);
  const swipe = useSwipe({
    onSwipeRight: showDayHeader ? goToPrev : undefined,
    onSwipeLeft: showDayHeader ? goToNext : undefined,
  });
  const feature = featureForPath(pathname);
  const tint = feature ? cardTintStyle(cardColor(feature), prefs.theme) : undefined;

  return (
    <main
      {...(showDayHeader ? swipe : {})}
      style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 16, ...tint }}
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
  const { isHidden } = useUiPrefs();

  useEffect(() => {
    if (!isLoggedIn()) router.replace("/login");
  }, [router]);

  // Push the user's palette onto <html> whenever /me (re)loads. Providers
  // already applied the cached copy before the first paint; this is what
  // makes a change on Settings -> Appearance take effect everywhere at once.
  const theme = me?.ui_prefs?.theme;
  useEffect(() => {
    if (me) applyTheme(theme ?? {});
  }, [me, theme]);

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
        {!isHidden("version_footer") && <VersionFooter />}
      </div>
      <TitleUnlockModal
        pending={me.pending_title_unlocks}
        pendingTotal={me.pending_title_unlocks_total}
      />
    </DayProvider>
  );
}
