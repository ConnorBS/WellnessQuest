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

export function formatViewedDay(iso: string, today: string): string {
  if (iso === today) return "Today";
  const yesterday = shiftIso(today, -1);
  if (iso === yesterday) return "Yesterday";
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  const sameYear = dt.getFullYear() === new Date(today + "T00:00:00").getFullYear();
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
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

  // Refresh "today" once a minute so a session that crosses midnight updates.
  useEffect(() => {
    const t = setInterval(() => {
      const fresh = todayLocalIso();
      setToday((prev) => (prev === fresh ? prev : fresh));
    }, 60_000);
    return () => clearInterval(t);
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
