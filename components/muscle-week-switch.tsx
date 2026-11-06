"use client";

import { useEffect, useRef, useState } from "react";
import { BAND_COLOR, WeekErBar } from "@/components/ui";
import { weeklyErBand } from "@/lib/targets";

export type MuscleWeekRow = {
  muscleGroup: string;
  now: { effectiveReps: number; hardSets: number };
  last: { effectiveReps: number; hardSets: number };
};

const WEEKS = ["This week", "Last week"] as const;

/**
 * The home drawer's this week / last week. One list that never moves: a swipe or
 * a tab tap swaps the week, and only the numbers, bar fill and colour change —
 * the muscle names and bars stay put (Vladimir, Nov 2026). Replaced a scroll-snap
 * carousel where the whole page slid sideways.
 */
export function MuscleWeekSwitch({ rows, empty }: { rows: MuscleWeekRow[]; empty: string }) {
  const [index, setIndex] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // A sideways flick, not a scroll: far enough, and more across than down.
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    setIndex(dx < 0 ? 1 : 0); // swipe left → last week, right → this week
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-1 px-4 pt-3">
        {WEEKS.map((label, i) => (
          <button
            key={label}
            onClick={() => setIndex(i)}
            aria-current={i === index ? "true" : undefined}
            className={`display min-h-11 rounded-lg border text-sm font-semibold transition-colors duration-300 ${
              i === index
                ? "border-accent bg-accent text-black"
                : "border-line-2 bg-panel-2 text-ink-dim"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="px-4 py-3" style={{ touchAction: "pan-y" }}
           onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-faint">{empty}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => {
              const w = index === 0 ? r.now : r.last;
              const band = weeklyErBand(w.effectiveReps);
              return (
                <li key={r.muscleGroup}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{r.muscleGroup}</span>
                    <span className="tnum text-xs">
                      <span className={`display text-base font-semibold transition-colors duration-500 ${BAND_COLOR[band]}`}>
                        <Counter value={w.effectiveReps} />
                      </span>
                      <span className="text-ink-faint"> eff reps · </span>
                      <span className="text-ink-dim"><Counter value={w.hardSets} /></span>
                      <span className="text-ink-faint"> hard sets</span>
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <WeekErBar er={w.effectiveReps} band={band} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/** A number that rolls to its new value over the same 500 ms the bar takes. */
function Counter({ value }: { value: number }) {
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
      const v = Math.round(a + (value - a) * eased);
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{shown}</>;
}
