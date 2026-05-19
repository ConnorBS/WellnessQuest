"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { useAcknowledgeTitle } from "@/hooks/useTitles";
import { TitleSummary } from "@/lib/schemas";

const RARITY_ACCENT: Record<string, { ring: string; glow: string }> = {
  common: { ring: "#94a3b8", glow: "rgba(148, 163, 184, 0.35)" },
  uncommon: { ring: "#4ade80", glow: "rgba(74, 222, 128, 0.35)" },
  rare: { ring: "#60a5fa", glow: "rgba(96, 165, 250, 0.45)" },
  epic: { ring: "#c084fc", glow: "rgba(192, 132, 252, 0.5)" },
  legendary: { ring: "#fbbf24", glow: "rgba(251, 191, 36, 0.55)" },
};

interface Props {
  pending: TitleSummary[];
}

/**
 * Surfaces newly-unlocked titles, one at a time, with a quick-dismissable
 * spring entrance. Reads `me.pending_title_unlocks` and acknowledges each
 * via the backend after the user dismisses.
 *
 * Mount once in the protected app layout — the local `dismissedId` state
 * lets us animate the exit before the React Query refetch removes the row
 * from `pending`, avoiding a flash where the next title pops in instantly.
 */
export function TitleUnlockModal({ pending }: Props) {
  const ack = useAcknowledgeTitle();
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const next = pending.find((t) => t.id !== dismissedId) ?? null;

  // Reset the dismiss filter when the backend confirms removal — otherwise a
  // re-equipped same-id title would never re-show.
  useEffect(() => {
    if (dismissedId && !pending.some((t) => t.id === dismissedId)) {
      setDismissedId(null);
    }
  }, [pending, dismissedId]);

  function dismiss() {
    if (!next) return;
    const id = next.id;
    setDismissedId(id);
    ack.mutate(id);
  }

  const accent = next ? RARITY_ACCENT[next.rarity] ?? RARITY_ACCENT.common : null;

  return (
    <AnimatePresence>
      {next && accent && (
        <motion.div
          key={next.id}
          role="dialog"
          aria-modal="true"
          aria-label="Title unlocked"
          onClick={dismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 24,
            cursor: "pointer",
          }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.7, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: -10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
            style={{
              maxWidth: 360,
              width: "100%",
              padding: "28px 24px",
              borderRadius: 16,
              background:
                "linear-gradient(180deg, rgba(15, 23, 42, 0.97) 0%, rgba(2, 6, 23, 0.97) 100%)",
              border: `1px solid ${accent.ring}`,
              boxShadow: `0 0 32px ${accent.glow}, 0 18px 48px rgba(0,0,0,0.6)`,
              textAlign: "center",
              cursor: "default",
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.25 }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: accent.ring,
              }}
            >
              Title Unlocked
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.22, type: "spring", stiffness: 280, damping: 20 }}
              style={{
                marginTop: 10,
                fontSize: 26,
                fontWeight: 700,
                color: "#f1f5f9",
                lineHeight: 1.2,
              }}
            >
              {next.name}
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.25 }}
              style={{
                marginTop: 6,
                fontSize: 13,
                color: "#94a3b8",
                fontStyle: "italic",
                textTransform: "capitalize",
              }}
            >
              {next.rarity}
            </motion.div>
            <motion.button
              type="button"
              onClick={dismiss}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.2 }}
              style={{
                marginTop: 20,
                padding: "8px 22px",
                background: accent.ring,
                color: "#0b1220",
                fontWeight: 600,
                border: 0,
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Dismiss
            </motion.button>
            <div style={{ marginTop: 10, fontSize: 11, color: "#64748b" }}>
              Tap anywhere to close
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
