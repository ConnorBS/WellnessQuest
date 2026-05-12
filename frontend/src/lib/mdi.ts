"use client";

// Lazy loader + cache for @mdi/js. The package is ~3MB of SVG path data; we
// dynamic-import it once on first use and cache the resulting object so
// subsequent icon renders are synchronous.

type IconMap = Record<string, string>;

let cached: IconMap | null = null;
let inflight: Promise<IconMap> | null = null;

export function getCachedMdi(): IconMap | null {
  return cached;
}

export function loadMdi(): Promise<IconMap> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = import("@mdi/js").then((mod) => {
    cached = mod as unknown as IconMap;
    return cached;
  });
  return inflight;
}

// Convert a kebab-case MDI name ("water-bottle") to the camelCase export key
// used by @mdi/js ("mdiWaterBottle").
export function mdiKey(name: string): string {
  return (
    "mdi" +
    name
      .split("-")
      .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : ""))
      .join("")
  );
}

export function pathForMdi(name: string, map: IconMap | null = cached): string | undefined {
  if (!map) return undefined;
  return map[mdiKey(name)];
}
