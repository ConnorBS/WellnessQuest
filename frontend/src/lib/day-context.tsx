"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function todayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftIso(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** Headline for the day switcher: "Today", "Yesterday", else the weekday. */
export function formatViewedDay(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === shiftIso(today, -1)) return "Yesterday";
  return toLocalDate(iso).toLocaleDateString(undefined, { weekday: "long" });
}

/**
 * The calendar date itself, shown under the headline so "Today" is never
 * ambiguous — and so a session that sat open across midnight makes the change
 * obvious rather than silently relabelling.
 */
export function formatViewedDate(iso: string, today: string): string {
  const dt = toLocalDate(iso);
  const sameYear = dt.getFullYear() === toLocalDate(today).getFullYear();
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

/** Milliseconds from `from` until the next local midnight. */
export function msUntilNextLocalMidnight(from: Date = new Date()): number {
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  return next.getTime() - from.getTime();
}

interface DayContextValue {
  viewedDay: string;
  today: string;
  isToday: boolean;
  goToPrev: () => void;
  goToNext: () => void;
  goToToday: () => void;
}

const DayContext = createContext<DayContextValue | null>(null);

export function DayProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState<string>(() => todayLocalIso());
  const [viewedDay, setViewedDay] = useState<string>(() => todayLocalIso());

  // Roll "today" over when the local date changes, so a session left open past
  // midnight relabels itself ("Today" becomes "Yesterday") instead of showing
  // stale data under a wrong heading. `viewedDay` deliberately does NOT follow
  // — the user stays on the day they were looking at.
  //
  // A bare interval isn't enough on mobile: timers are throttled or frozen
  // entirely while the PWA is backgrounded, which is exactly when midnight
  // passes. So: an alarm aimed at the next midnight, plus a re-check every time
  // the app comes back to the foreground, plus a slow interval as a backstop.
  useEffect(() => {
    let alarm: ReturnType<typeof setTimeout> | undefined;

    function sync() {
      setToday((prev) => {
        const fresh = todayLocalIso();
        return prev === fresh ? prev : fresh;
      });
      schedule();
    }

    function schedule() {
      if (alarm !== undefined) clearTimeout(alarm);
      // +1s so the timer never fires a hair before the date actually ticks.
      alarm = setTimeout(sync, msUntilNextLocalMidnight() + 1_000);
    }

    function syncIfVisible() {
      if (document.visibilityState === "visible") sync();
    }

    schedule();
    const backstop = setInterval(sync, 60_000);
    document.addEventListener("visibilitychange", syncIfVisible);
    window.addEventListener("focus", syncIfVisible);
    window.addEventListener("pageshow", syncIfVisible);

    return () => {
      if (alarm !== undefined) clearTimeout(alarm);
      clearInterval(backstop);
      document.removeEventListener("visibilitychange", syncIfVisible);
      window.removeEventListener("focus", syncIfVisible);
      window.removeEventListener("pageshow", syncIfVisible);
    };
  }, []);

  const goToPrev = useCallback(() => {
    setViewedDay((d) => shiftIso(d, -1));
  }, []);

  const goToNext = useCallback(() => {
    setViewedDay((d) => {
      const next = shiftIso(d, 1);
      // Never travel to the future.
      return compareIso(next, today) > 0 ? d : next;
    });
  }, [today]);

  const goToToday = useCallback(() => {
    setViewedDay(today);
  }, [today]);

  const value = useMemo<DayContextValue>(() => {
    return {
      viewedDay,
      today,
      isToday: viewedDay === today,
      goToPrev,
      goToNext,
      goToToday,
    };
  }, [viewedDay, today, goToPrev, goToNext, goToToday]);

  return <DayContext.Provider value={value}>{children}</DayContext.Provider>;
}

export function useViewedDay(): DayContextValue {
  const ctx = useContext(DayContext);
  if (!ctx) {
    // Safety: render-time fallback if used outside the provider (e.g. tests).
    const today = todayLocalIso();
    return {
      viewedDay: today,
      today,
      isToday: true,
      goToPrev: () => {},
      goToNext: () => {},
      goToToday: () => {},
    };
  }
  return ctx;
}
