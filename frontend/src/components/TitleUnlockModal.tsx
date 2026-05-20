"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { useAcknowledgeAllTitles, useAcknowledgeTitle } from "@/hooks/useTitles";
import { TitleSummary } from "@/lib/schemas";

interface RarityAccent {
  ring: string;
  glow: string;
  burstColors: string[];
  particleCount: number;
}

const RARITY_ACCENT: Record<string, RarityAccent> = {
  common: {
    ring: "#94a3b8",
    glow: "rgba(148, 163, 184, 0.35)",
    burstColors: ["#94a3b8", "#cbd5e1", "#e2e8f0"],
    particleCount: 14,
  },
  uncommon: {
    ring: "#4ade80",
    glow: "rgba(74, 222, 128, 0.4)",
    burstColors: ["#4ade80", "#86efac", "#bbf7d0"],
    particleCount: 18,
  },
  rare: {
    ring: "#60a5fa",
    glow: "rgba(96, 165, 250, 0.5)",
    burstColors: ["#60a5fa", "#93c5fd", "#bfdbfe", "#f0f9ff"],
    particleCount: 24,
  },
  epic: {
    ring: "#c084fc",
    glow: "rgba(192, 132, 252, 0.55)",
    burstColors: ["#c084fc", "#d8b4fe", "#f0abfc", "#fae8ff"],
    particleCount: 32,
  },
  legendary: {
    ring: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.6)",
    burstColors: ["#fbbf24", "#fcd34d", "#fde68a", "#fef3c7", "#fff7ed"],
    particleCount: 44,
  },
};

interface Particle {
  id: number;
  color: string;
  angle: number;
  distance: number;
  size: number;
  delay: number;
}

function buildParticles(accent: RarityAccent, seed: string): Particle[] {
  // Deterministic per-title-id so React doesn't reshuffle when the parent
  // re-renders mid-animation; same id = same burst layout for the duration
  // of this popup instance.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
  const fallback = accent.burstColors[0] ?? accent.ring;
  return Array.from({ length: accent.particleCount }, (_, i) => ({
    id: i,
    color:
      accent.burstColors[Math.floor(rand() * accent.burstColors.length)] ??
      fallback,
    angle: rand() * Math.PI * 2,
    distance: 120 + rand() * 140,
    size: 6 + rand() * 8,
    delay: rand() * 0.12,
  }));
}

interface Props {
  pending: TitleSummary[];
  /**
   * True count of un-acknowledged unlocks from /me. `pending` is capped at
   * the server's PENDING_UNLOCKS_LIMIT (5), so after a catalog rollout
   * `pending.length` can be 5 while there are dozens still queued. The UI
   * needs the real total to label "Accept all (N)" honestly.
   */
  pendingTotal: number;
}

/**
 * Surfaces newly-unlocked titles with a hype burst (rarity-scaled particle
 * confetti + glow pulse). Shows the unlock requirement (`description`) so
 * the user can see *why* they earned it — without that, names like
 * "Marvin's Mood" are meaningless.
 *
 * Reads `me.pending_title_unlocks` and acknowledges each via the backend
 * after dismissal. When 2+ unlocks are queued an "Accept all" button
 * dismisses them in a single round-trip, useful after a catalog deploy
 * where a user can wake up with a dozen retroactive unlocks waiting.
 *
 * Mount once in the protected app layout — local `dismissedId` lets us
 * animate the exit before the React Query refetch removes the row from
 * `pending`, so the next title doesn't snap in instantly.
 */
export function TitleUnlockModal({ pending, pendingTotal }: Props) {
  const ack = useAcknowledgeTitle();
  const ackAll = useAcknowledgeAllTitles();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [dismissingAll, setDismissingAll] = useState(false);

  const next = pending.find((t) => t.id !== dismissedId) ?? null;
  // `remaining` is what's left after dismissing the current one. Use the
  // server-reported total instead of `pending.length` so the count is
  // honest when there are more queued than the /me cap returns.
  const remaining = Math.max(0, pendingTotal - (dismissedId ? 1 : 0));
  const accent = next ? RARITY_ACCENT[next.rarity] ?? RARITY_ACCENT.common : null;

  const particles = useMemo(
    () => (next && accent ? buildParticles(accent, next.id) : []),
    [next, accent],
  );

  useEffect(() => {
    if (dismissedId && !pending.some((t) => t.id === dismissedId)) {
      setDismissedId(null);
    }
  }, [pending, dismissedId]);

  useEffect(() => {
    if (dismissingAll && pending.length === 0) setDismissingAll(false);
  }, [dismissingAll, pending.length]);

  function dismiss() {
    if (!next) return;
    const id = next.id;
    setDismissedId(id);
    ack.mutate(id);
  }

  function dismissAll() {
    if (pending.length === 0) return;
    setDismissingAll(true);
    setDismissedId(null);
    ackAll.mutate();
  }

  const open = next != null && accent != null && !dismissingAll;

  return (
    <AnimatePresence>
      {open && (
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
            background: "rgba(2, 6, 23, 0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 24,
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.85, 0], scale: [0.5, 1.4, 2.2] }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            style={{
              position: "absolute",
              width: 320,
              height: 320,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${accent.glow} 0%, transparent 70%)`,
              filter: "blur(8px)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            {particles.map((p) => (
              <motion.span
                key={p.id}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
                animate={{
                  x: Math.cos(p.angle) * p.distance,
                  y: Math.sin(p.angle) * p.distance,
                  opacity: [0, 1, 1, 0],
                  scale: [0.4, 1, 1, 0.6],
                  rotate: 360,
                }}
                transition={{
                  duration: 1.2 + p.distance / 400,
                  delay: p.delay,
                  ease: "easeOut",
                  times: [0, 0.15, 0.7, 1],
                }}
                style={{
                  position: "absolute",
                  width: p.size,
                  height: p.size,
                  borderRadius: 2,
                  background: p.color,
                  boxShadow: `0 0 8px ${p.color}`,
                }}
              />
            ))}
          </div>
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.6, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: -10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            style={{
              position: "relative",
              maxWidth: 380,
              width: "100%",
              padding: "28px 24px",
              borderRadius: 18,
              background:
                "linear-gradient(180deg, rgba(15, 23, 42, 0.97) 0%, rgba(2, 6, 23, 0.97) 100%)",
              border: `1px solid ${accent.ring}`,
              boxShadow: `0 0 36px ${accent.glow}, 0 18px 48px rgba(0,0,0,0.65)`,
              textAlign: "center",
              cursor: "default",
            }}
          >
            <motion.div
              aria-hidden
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: [0.6, 0.25, 0.6], scale: [1, 1.03, 1] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute",
                inset: -1,
                borderRadius: 18,
                border: `1px solid ${accent.ring}`,
                boxShadow: `0 0 22px ${accent.glow}`,
                pointerEvents: "none",
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.25 }}
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2.2,
                textTransform: "uppercase",
                color: accent.ring,
              }}
            >
              Title Unlocked
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.22, type: "spring", stiffness: 280, damping: 18 }}
              style={{
                marginTop: 10,
                fontSize: 28,
                fontWeight: 800,
                color: "#f8fafc",
                lineHeight: 1.15,
                textShadow: `0 0 18px ${accent.glow}`,
              }}
            >
              {next.name}
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.32, duration: 0.25 }}
              style={{
                marginTop: 8,
                display: "inline-flex",
                gap: 8,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
                color: accent.ring,
              }}
            >
              <span style={{ textTransform: "uppercase", letterSpacing: 1.2 }}>
                {next.rarity}
              </span>
              <span style={{ color: "#475569" }}>•</span>
              <span style={{ color: "#94a3b8", textTransform: "capitalize" }}>
                {next.category.replace(/_/g, " ")}
              </span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.25 }}
              style={{
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(148, 163, 184, 0.18)",
                fontSize: 13,
                color: "#cbd5e1",
                lineHeight: 1.45,
              }}
            >
              {next.description}
            </motion.div>
            <motion.button
              type="button"
              onClick={dismiss}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.2 }}
              style={{
                marginTop: 20,
                padding: "10px 24px",
                background: accent.ring,
                color: "#0b1220",
                fontWeight: 700,
                border: 0,
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {remaining > 1 ? `Next (${remaining - 1} more)` : "Dismiss"}
            </motion.button>
            {remaining > 1 && (
              <motion.button
                type="button"
                onClick={dismissAll}
                disabled={ackAll.isPending}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.62, duration: 0.2 }}
                style={{
                  display: "block",
                  margin: "10px auto 0",
                  padding: "6px 16px",
                  background: "transparent",
                  color: "#94a3b8",
                  border: "1px solid rgba(148, 163, 184, 0.4)",
                  borderRadius: 999,
                  cursor: ackAll.isPending ? "wait" : "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {ackAll.isPending ? "Dismissing…" : `Accept all (${remaining})`}
              </motion.button>
            )}
            <div style={{ marginTop: 10, fontSize: 11, color: "#64748b" }}>
              Tap anywhere to close
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
