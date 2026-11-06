"use client";

import { useEffect, useRef, useState } from "react";

/** Same as the stats screens: whole numbers plain, helper halves to one place. */
export const fmtCredit = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** A number that rolls to its new value over the same 500 ms the bars take.
 *  Steps in halves (helper muscles score ½) and lands on the exact value. */
export function RollingNumber({ value, format = fmtCredit }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const a = from.current;
    if (a === value) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 500);
      const eased = 1 - (1 - p) ** 3;
      const v = p === 1 ? value : Math.round((a + (value - a) * eased) * 2) / 2;
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{format(shown)}</>;
}

/**
 * A sideways flick on a list that still scrolls up and down: far enough, and more
 * across than down. `onSwipe(-1)` for a finger moving left, `+1` for right. Pair
 * with `touch-action: pan-y` on the element.
 */
export function useSideSwipe(onSwipe: (dir: -1 | 1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart(e: React.TouchEvent) {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd(e: React.TouchEvent) {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      onSwipe(dx < 0 ? -1 : 1);
    },
    style: { touchAction: "pan-y" } as const,
  };
}
