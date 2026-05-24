"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

interface Props {
  title: string;
  ariaLabel?: string;
  onClose: () => void;
  // Save handler; the shell renders the Save/Cancel row so each drawer
  // body only needs to render its fields.
  onSave: () => void;
  saving?: boolean;
  // Error message rendered above the action row. Null/undefined hides it.
  errorMessage?: string | null;
  saveDisabled?: boolean;
  children: ReactNode;
}

export function EditDrawerShell({
  title,
  ariaLabel,
  onClose,
  onSave,
  saving = false,
  errorMessage,
  saveDisabled = false,
  children,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      onClick={onClose}
      style={overlayStyle}
    >
      <div onClick={(e) => e.stopPropagation()} style={panelStyle}>
        <header style={headerStyle}>
          <h2 style={titleStyle}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={closeBtn}
          >
            ×
          </button>
        </header>

        {children}

        {errorMessage ? (
          <p style={{ fontSize: 12, color: "#fca5a5", margin: 0 }}>
            {errorMessage}
          </p>
        ) : null}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || saveDisabled}
            style={primaryBtnStyleFor(saving || saveDisabled)}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Shared input styles re-exported so the per-metric drawers can keep
// visual parity with the existing food edit drawer without each one
// copying the same CSSProperties literals.
export const fieldLabel: CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 4,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 14,
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  zIndex: 60,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
};

const panelStyle: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 12,
  padding: 16,
  width: "100%",
  maxWidth: 440,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const titleStyle: CSSProperties = { fontSize: 16, fontWeight: 600, margin: 0 };

const closeBtn: CSSProperties = {
  background: "transparent",
  color: "#94a3b8",
  border: "none",
  fontSize: 20,
};

const ghostBtn: CSSProperties = {
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #1e293b",
  borderRadius: 6,
  padding: "10px 14px",
  fontSize: 14,
  cursor: "pointer",
};

function primaryBtnStyleFor(disabled: boolean): CSSProperties {
  return {
    background: disabled ? "#1e293b" : "#10b981",
    color: disabled ? "#64748b" : "white",
    border: "none",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
