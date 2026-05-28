"use client";

import { useRef } from "react";

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

interface Opts {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal pixels for a swipe to register. */
  threshold?: number;
}

/** True when the user has pinch-zoomed in, so a one-finger drag is a pan. */
function isZoomedIn(): boolean {
  if (typeof window === "undefined" || !window.visualViewport) return false;
  return window.visualViewport.scale > 1.01;
}

/**
 * Decide the swipe direction from a completed gesture. Pure so it can be unit
 * tested without a DOM. `armed` is false when the gesture wasn't a clean
 * single-finger drag (a second finger landed, or it started pinched/zoomed).
 */
export function resolveSwipe(opts: {
  armed: boolean;
  zoomed: boolean;
  dx: number;
  dy: number;
  threshold: number;
}): "left" | "right" | null {
  if (!opts.armed || opts.zoomed) return null;
  if (Math.abs(opts.dx) < opts.threshold || Math.abs(opts.dx) < Math.abs(opts.dy) * 2) {
    return null;
  }
  return opts.dx > 0 ? "right" : "left";
}

/**
 * Detect a horizontal swipe on touch devices without hijacking vertical scroll,
 * pinch-zoom, or panning of a zoomed-in page.
 *
 * A swipe registers only when ALL of these hold:
 *  - the gesture was a single finger from start to finish (a second finger
 *    landing mid-gesture disarms it, so pinch-zoom never changes the day);
 *  - the page is not currently pinch-zoomed in (so a one-finger pan of a zoomed
 *    page scrolls instead of navigating);
 *  - the horizontal delta exceeds `threshold` AND is meaningfully greater than
 *    the vertical delta (>= 2x), so vertical scrolling doesn't trigger it.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60 }: Opts): SwipeHandlers {
  const startX = useRef(0);
  const startY = useRef(0);
  const armed = useRef(false);

  return {
    onTouchStart: (e) => {
      if (e.touches.length !== 1 || isZoomedIn()) {
        armed.current = false;
        return;
      }
      const t = e.touches[0];
      if (!t) {
        armed.current = false;
        return;
      }
      armed.current = true;
      startX.current = t.clientX;
      startY.current = t.clientY;
    },
    onTouchMove: (e) => {
      if (e.touches.length > 1) armed.current = false;
    },
    onTouchEnd: (e) => {
      const t = e.changedTouches[0];
      if (!t) {
        armed.current = false;
        return;
      }
      const dir = resolveSwipe({
        armed: armed.current,
        zoomed: isZoomedIn(),
        dx: t.clientX - startX.current,
        dy: t.clientY - startY.current,
        threshold,
      });
      armed.current = false;
      if (dir === "right") onSwipeRight?.();
      else if (dir === "left") onSwipeLeft?.();
    },
  };
}
