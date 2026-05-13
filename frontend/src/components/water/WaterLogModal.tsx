"use client";

import { useEffect, useMemo, useState } from "react";

import { useAddWater } from "@/hooks/useAddWater";
import { useCreatePreset } from "@/hooks/useWaterPresets";
import { useRecentWater } from "@/hooks/useRecentWater";
import { ApiError } from "@/lib/api";
import { uuidv4 } from "@/lib/uuid";

interface Props {
  onClose: () => void;
}

// US "customary" cup. Matches what food's portion picker uses for liquids,
// so a "cup" means the same thing across the app even though metric kitchens
// use 250 mL. Switch to a user preference later if anyone asks.
const ML_PER_CUP = 240;

type Unit = "ml" | "cup";

const SEED_SUGGESTIONS = [
  "Glass",
  "Bottle",
  "Mug",
  "Coffee",
  "Tea",
];

export function WaterLogModal({ onClose }: Props) {
  const [amount, setAmount] = useState<number | "">("");
  const [unit, setUnit] = useState<Unit>("ml");
  const [name, setName] = useState("");
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const add = useAddWater();
  const createPreset = useCreatePreset();
  const recent = useRecentWater(12);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of recent.data ?? []) {
      const key = r.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(r.name.trim());
    }
    for (const s of SEED_SUGGESTIONS) {
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }, [recent.data]);

  const amountNum = typeof amount === "number" ? amount : Number(amount);
  const ml =
    Number.isFinite(amountNum) && amountNum > 0
      ? Math.round(unit === "cup" ? amountNum * ML_PER_CUP : amountNum)
      : 0;
  // Backend caps water entries at 5000 ml — surface that as a UI validity
  // check so cup users don't hit a 422 they can't make sense of.
  const valid = ml >= 1 && ml <= 5000;

  function handleLog() {
    if (!valid) return;
    setErrorMsg(null);
    const trimmed = name.trim();
    const entryName = trimmed ? trimmed.slice(0, 60) : null;
    add.mutate(
      { ml, client_id: uuidv4(), name: entryName },
      {
        onSuccess: () => {
          if (saveAsPreset) {
            createPreset.mutate({
              label: entryName ?? `${ml} mL`,
              volume_ml: ml,
              icon_kind: "none",
              icon_key: null,
              sort_order: 0,
            });
          }
          onClose();
        },
        onError: (err) => setErrorMsg(formatLogError(err)),
      },
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Log water"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 50,
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
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Log water</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              color: "#94a3b8",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            <span style={labelStyle}>
              Name <span style={{ color: "#64748b" }}>(optional)</span>
            </span>
            <input
              type="text"
              maxLength={60}
              placeholder="e.g. Bottle, Mug, Coffee"
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="water-recent-suggestions"
              style={inputStyle}
              data-testid="water-log-name"
            />
            <datalist id="water-recent-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>

          <label>
            <span style={labelStyle}>Amount</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                inputMode={unit === "cup" ? "decimal" : "numeric"}
                min={unit === "cup" ? 0.1 : 1}
                max={unit === "cup" ? 20 : 5000}
                step={unit === "cup" ? 0.25 : 1}
                placeholder={unit === "cup" ? "e.g. 1.5" : "e.g. 250"}
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value === "" ? "" : Number(e.target.value))
                }
                style={{ ...inputStyle, flex: 1 }}
                data-testid="water-log-amount"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                style={{ ...inputStyle, width: 96 }}
                data-testid="water-log-unit"
                aria-label="Unit"
              >
                <option value="ml">mL</option>
                <option value="cup">cup</option>
              </select>
            </div>
            {unit === "cup" && ml > 0 && (
              <span
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  display: "block",
                  marginTop: 4,
                }}
              >
                ≈ {ml} mL ({ML_PER_CUP} mL per cup)
              </span>
            )}
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "#cbd5e1",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={saveAsPreset}
              onChange={(e) => setSaveAsPreset(e.target.checked)}
            />
            Save as quick water button
          </label>

          {errorMsg ? (
            <p
              role="alert"
              data-testid="water-log-error"
              style={{
                margin: 0,
                padding: "8px 10px",
                fontSize: 13,
                color: "#fca5a5",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.35)",
                borderRadius: 6,
              }}
            >
              {errorMsg}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleLog}
            disabled={!valid || add.isPending}
            data-testid="water-log-submit"
            style={{
              background: !valid || add.isPending ? "#1e293b" : "#10b981",
              color: !valid || add.isPending ? "#64748b" : "white",
              border: "none",
              borderRadius: 6,
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 600,
              cursor: !valid || add.isPending ? "not-allowed" : "pointer",
              opacity: !valid || add.isPending ? 0.7 : 1,
            }}
          >
            {add.isPending ? "Logging…" : "Log it"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatLogError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
    return `Server error ${err.status}`;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Couldn't reach the server. Check your connection and try again.";
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 14,
};
