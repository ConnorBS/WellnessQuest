"use client";

import { useEffect, useState } from "react";

import { getCachedMdi, loadMdi, pathForMdi } from "@/lib/mdi";
import { resolveIconName } from "@/lib/mdi-aliases";

interface Props {
  name: string;
  size?: number;
  color?: string;
}

function FallbackIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
    </svg>
  );
}

export function MdiIcon({ name, size = 24, color }: Props) {
  const [icons, setIcons] = useState(getCachedMdi());

  useEffect(() => {
    if (icons) return;
    let cancelled = false;
    loadMdi().then((m) => {
      if (!cancelled) setIcons(m);
    });
    return () => {
      cancelled = true;
    };
  }, [icons]);

  const resolved = resolveIconName(name);
  const path = pathForMdi(resolved, icons) ?? pathForMdi("circle-outline", icons);

  if (!path) return <FallbackIcon size={size} />;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color ?? "currentColor"}
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}
