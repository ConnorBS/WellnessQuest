"use client";

import { useEffect, useRef, useState } from "react";

// BarcodeDetector is a browser-native API (Chromium-based browsers; Samsung
// Internet, Chrome Android, Edge). Safari/Firefox don't expose it.
interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): {
    detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
  };
  getSupportedFormats(): Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;
  const [mode, setMode] = useState<"camera" | "manual">(supported ? "camera" : "manual");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submitTyped() {
    const cleaned = typed.replace(/\D/g, "");
    if (cleaned.length < 6 || cleaned.length > 14) {
      setError("Barcode should be 6-14 digits.");
      return;
    }
    setError(null);
    onDetected(cleaned);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan barcode"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 12,
          padding: 16,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Scan barcode</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              color: "#94a3b8",
              border: "none",
              fontSize: 20,
            }}
          >
            ×
          </button>
        </header>

        {supported && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setMode("camera")}
              style={tabStyle(mode === "camera")}
            >
              Camera
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              style={tabStyle(mode === "manual")}
            >
              Type it
            </button>
          </div>
        )}

        {mode === "camera" && supported ? (
          <CameraScanner onDetected={onDetected} onError={setError} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!supported && (
              <p style={{ fontSize: 12, color: "#94a3b8" }}>
                Your browser doesn&apos;t support live barcode scanning. Type it from the package.
              </p>
            )}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              placeholder="e.g. 5000169005000"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitTyped();
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: 6,
                color: "#e2e8f0",
                fontSize: 14,
              }}
            />
            <button
              type="button"
              onClick={submitTyped}
              style={{
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "8px 12px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Look up
            </button>
          </div>
        )}

        {error && (
          <p style={{ marginTop: 8, fontSize: 13, color: "#fca5a5" }}>{error}</p>
        )}
      </div>
    </div>
  );
}

function CameraScanner({
  onDetected,
  onError,
}: {
  onDetected: (code: string) => void;
  onError: (msg: string | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    stopRef.current = false;
    let detector: { detect(v: HTMLVideoElement): Promise<DetectedBarcode[]> } | null = null;

    async function start() {
      onError(null);
      try {
        const Ctor = window.BarcodeDetector!;
        const supportedFormats = await Ctor.getSupportedFormats();
        const formats = FORMATS.filter((f) => supportedFormats.includes(f));
        detector = new Ctor({ formats: formats.length ? formats : undefined });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setScanning(true);
        // Poll the live video for barcodes. ~6 fps is plenty and keeps CPU low.
        while (!stopRef.current && videoRef.current) {
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0]!.rawValue) {
              onDetected(codes[0]!.rawValue);
              break;
            }
          } catch {
            // detect() can throw transiently while the camera warms up; ignore.
          }
          await new Promise((r) => setTimeout(r, 160));
        }
      } catch (err) {
        const name = err instanceof Error ? err.name : "Error";
        if (name === "NotAllowedError") {
          onError("Camera permission denied. Type the barcode instead.");
        } else if (name === "NotFoundError") {
          onError("No camera found. Type the barcode instead.");
        } else {
          onError("Could not start camera. Type the barcode instead.");
        }
      }
    }
    start();

    const video = videoRef.current;
    return () => {
      stopRef.current = true;
      setScanning(false);
      const stream = streamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
        streamRef.current = null;
      }
      if (video) video.srcObject = null;
    };
    // onDetected/onError are stable enough (parent uses inline closures but the
    // mount lifecycle here is "open scanner -> first hit -> close"), so we only
    // run this once per scanner instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          width: "100%",
          maxHeight: "60vh",
          background: "#020617",
          borderRadius: 8,
        }}
      />
      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
        {scanning ? "Hold a barcode in view…" : "Starting camera…"}
      </p>
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "6px 10px",
    background: active ? "#1e293b" : "transparent",
    color: active ? "#e2e8f0" : "#94a3b8",
    border: "1px solid #1e293b",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  };
}
