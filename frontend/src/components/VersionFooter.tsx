"use client";

import { useEffect, useState } from "react";

import { fetchVersion, type Version } from "@/lib/version";

export function VersionFooter() {
  const [info, setInfo] = useState<Version | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVersion()
      .then((v) => {
        if (!cancelled) setInfo(v);
      })
      .catch(() => {
        /* swallow — a broken /version endpoint shouldn't poison the page */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info) return null;

  const shortSha = info.git_sha ? info.git_sha.slice(0, 7) : null;
  const label = shortSha ? `v${info.version} · ${shortSha}` : `v${info.version}`;

  return (
    <footer
      style={{
        marginTop: 24,
        paddingTop: 12,
        textAlign: "center",
        fontSize: 12,
        color: "var(--wq-muted-2)",
      }}
      title={info.build_timestamp ? `Built ${info.build_timestamp}` : undefined}
    >
      {label}
    </footer>
  );
}
