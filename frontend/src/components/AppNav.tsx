"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { clearTokens } from "@/lib/auth";
import { useFeatures } from "@/hooks/useFeatures";

// `feature` gates a link on the user's toggle; links without one are always shown.
const LINKS: { href: string; label: string; feature?: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/water", label: "Water", feature: "water" },
  { href: "/food", label: "Food", feature: "food" },
  { href: "/activity", label: "Activity", feature: "activity" },
  { href: "/habits", label: "Habits", feature: "habits" },
  { href: "/weight", label: "Weight", feature: "weight" },
  { href: "/blood-pressure", label: "BP", feature: "blood_pressure" },
  { href: "/mood", label: "Mood", feature: "mood" },
  { href: "/settings", label: "Settings" },
];

export function AppNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { isEnabled } = useFeatures();
  const [open, setOpen] = useState(false);
  const links = LINKS.filter((l) => !l.feature || isEnabled(l.feature));

  // Collapse the mobile menu after navigating so a tap on a link doesn't
  // leave the dropdown covering the page it just opened.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function onLogout() {
    clearTokens();
    router.replace("/login");
  }

  return (
    <header className="wq-header">
      <Link href="/dashboard" className="wq-brand">
        WellnessQuest
      </Link>
      <button
        type="button"
        className="wq-nav-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "✕" : "☰"}
      </button>
      <nav className="wq-nav" data-open={open ? "true" : "false"}>
        {links.map((l) => {
          const active = pathname === l.href || (pathname?.startsWith(l.href + "/") ?? false);
          return (
            <Link
              key={l.href}
              href={l.href}
              className="wq-nav-link"
              data-active={active ? "true" : undefined}
              aria-current={active ? "page" : undefined}
            >
              {l.label}
            </Link>
          );
        })}
        <button type="button" onClick={onLogout} className="wq-nav-link wq-signout">
          Sign out
        </button>
      </nav>
    </header>
  );
}
