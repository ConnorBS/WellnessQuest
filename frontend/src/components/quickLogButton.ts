import type { CSSProperties } from "react";

// Shared style for the dashboard "+ Log" buttons that open each section's
// logging modal. Compact so it sits inline next to the card's total/link.
export const quickLogBtn: CSSProperties = {
  background: "var(--wq-accent)",
  color: "var(--wq-on-accent)",
  border: "none",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
