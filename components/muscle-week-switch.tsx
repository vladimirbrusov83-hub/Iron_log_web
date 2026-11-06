"use client";

import { useState } from "react";
import { RollingNumber, useSideSwipe } from "@/components/animated";
import { BAND_COLOR, WeekErBar } from "@/components/ui";
import { weeklyErBand } from "@/lib/targets";

export type MuscleWeekRow = {
  muscleGroup: string;
  now: { effectiveReps: number; hardSets: number };
  last: { effectiveReps: number; hardSets: number };
};

// Last week on the left, this week on the right, like a timeline (Vladimir, Nov 2026).
// The index is still 0 = this week, which is what the switch opens on.
const WEEKS = [{ label: "Last week", i: 1 }, { label: "This week", i: 0 }] as const;

/**
 * The home drawer's this week / last week. One list that never moves: a swipe or
 * a tab tap swaps the week, and only the numbers, bar fill and colour change —
 * the muscle names and bars stay put (Vladimir, Nov 2026). Replaced a scroll-snap
 * carousel where the whole page slid sideways.
 */
export function MuscleWeekSwitch({ rows, empty }: { rows: MuscleWeekRow[]; empty: string }) {
  const [index, setIndex] = useState(0);
  // Endless: with two weeks every swipe, either way, flips to the other one (Vladimir, Nov 2026).
  const swipe = useSideSwipe(() => setIndex((i) => 1 - i));

  return (
    <>
      <div className="grid grid-cols-2 gap-1 px-4 pt-3">
        {WEEKS.map(({ label, i }) => (
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
      <div className="px-4 py-3" style={swipe.style}
           onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
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
                        <RollingNumber value={w.effectiveReps} />
                      </span>
                      <span className="text-ink-faint"> eff reps · </span>
                      <span className="text-ink-dim"><RollingNumber value={w.hardSets} /></span>
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
