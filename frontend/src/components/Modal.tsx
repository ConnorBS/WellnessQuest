"use client";

import { useEffect } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ title, onClose, children }: Props) {
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
      aria-label={title}
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
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>{title}</h2>
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
        {children}
      </div>
    </div>
  );
}
