"use client";

import { useRef } from "react";

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

interface Opts {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal pixels for a swipe to register. */
  threshold?: number;
}

/**
 * Detect a horizontal swipe on touch devices without hijacking vertical scroll.
 *
 * A swipe registers only when the horizontal delta exceeds `threshold` AND is
 * meaningfully greater than the vertical delta (>= 2×). This lets the user
 * scroll the page vertically without accidentally triggering day navigation.
 *
 * Pointer events also fire `touchstart` on tap; the threshold filters those.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60 }: Opts): SwipeHandlers {
  const startX = useRef(0);
  const startY = useRef(0);

  return {
    onTouchStart: (e) => {
      const t = e.touches[0];
      if (!t) return;
      startX.current = t.clientX;
      startY.current = t.clientY;
    },
    onTouchEnd: (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX.current;
      const dy = Math.abs(t.clientY - startY.current);
      if (Math.abs(dx) < threshold || Math.abs(dx) < dy * 2) return;
      if (dx > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    },
  };
}
