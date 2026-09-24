"use client";

import { useEffect, useState } from "react";

/**
 * How long the workout has been running, top right of both gym screens. The
 * rest timer keeps the bottom of the screen; this one never needs a tap.
 *
 * Worked out from `startedAt` on every tick rather than counted up, for the
 * same reason as the rest timer: iOS throttles timers on a locked phone, and a
 * counter would come back behind. It renders nothing until mounted so the
 * server's clock and the phone's never disagree in the first paint.
 */
export function WorkoutClock({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = now === null
    ? null
    : Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));

  return (
    <div
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line-2
                 bg-panel-2 px-3 text-ink-dim"
      aria-label="Workout time"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5M9 2h6" />
      </svg>
      <span className="display tnum text-xl font-semibold leading-none text-ink">
        {seconds === null ? "–:––" : format(seconds)}
      </span>
    </div>
  );
}

function format(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
