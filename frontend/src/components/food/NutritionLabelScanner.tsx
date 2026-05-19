"use client";

import { useRef, useState } from "react";

import { useFoodScanLabel } from "@/hooks/useFoodScanLabel";
import { ApiError } from "@/lib/api";
import type { LabelScanOut } from "@/lib/schemas";

interface Props {
  onScanned: (parsed: LabelScanOut, file: File) => void;
  variant?: "primary" | "ghost";
  label?: string;
}

/**
 * Button + hidden file input that opens the device camera or photo picker
 * and posts the chosen image to /food/scan-label. The parent receives the
 * structured result and is responsible for routing it to the review screen.
 *
 * Mirrors the file-input pattern used in `PresetForm.tsx` for icon uploads,
 * with `capture="environment"` so mobile users go straight to the rear cam.
 */
export function NutritionLabelScanner({ onScanned, variant = "ghost", label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const scan = useFoodScanLabel();

  function pick() {
    setError(null);
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    scan.mutate(file, {
      onSuccess: (parsed) => onScanned(parsed, file),
      onError: (err) => {
        const body = err instanceof ApiError ? (err.body as { detail?: string } | null) : null;
        setError(body?.detail ?? "Scan failed — try a clearer photo or enter manually.");
      },
    });
  }

  const isBusy = scan.isPending;
  return (
    <>
      <button type="button" onClick={pick} disabled={isBusy} style={buttonStyleFor(variant, isBusy)}>
        {isBusy ? "Reading label…" : label ?? "Scan nutrition label"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onChange}
        style={{ display: "none" }}
      />
      {error ? (
        <p style={{ fontSize: 12, color: "#fca5a5", marginTop: 6 }}>{error}</p>
      ) : null}
    </>
  );
}

function buttonStyleFor(variant: "primary" | "ghost", busy: boolean): React.CSSProperties {
  if (variant === "primary") {
    return {
      background: busy ? "#1e293b" : "#10b981",
      color: busy ? "#64748b" : "white",
      border: "none",
      borderRadius: 6,
      padding: "8px 12px",
      fontSize: 13,
      fontWeight: 600,
      cursor: busy ? "not-allowed" : "pointer",
    };
  }
  return {
    background: "transparent",
    color: busy ? "#64748b" : "#10b981",
    border: "1px solid #1e293b",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: busy ? "not-allowed" : "pointer",
  };
}
