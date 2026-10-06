"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import type { WeeklyMuscleRow } from "@/lib/db";
import { MUSCLE_GROUPS } from "@/lib/types";

const ALL = "All";
const STORE_KEY = "ironlog.stats.muscle";

/**
 * One chart, one muscle at a time: effective reps per week over the last
 * twelve weeks, empty weeks drawn as gaps. The chip row picks the muscle;
 * the choice is remembered on this phone only.
 */
export function WeeklyChart({ weeks, rows }: { weeks: string[]; rows: WeeklyMuscleRow[] }) {
  const [muscle, setMuscle] = useState(ALL);

  // Groups with anything in the window, in library order.
  const present = new Set(rows.map((r) => r.muscleGroup));
  const muscles = [
    ...MUSCLE_GROUPS.filter((g) => present.has(g)),
    ...[...present].filter((g) => !(MUSCLE_GROUPS as readonly string[]).includes(g)).sort(),
  ];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved && present.has(saved)) setMuscle(saved);
    } catch { /* storage blocked — stay on All */ }
    // Read once on mount; `present` is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(m: string) {
    setMuscle(m);
    try { localStorage.setItem(STORE_KEY, m); } catch { /* ignore */ }
  }

  const picked = rows.filter((r) => muscle === ALL || r.muscleGroup === muscle);
  const bars = weeks.map((w) => {
    const inWeek = picked.filter((r) => r.weekStart === w);
    return {
      week: w,
      er: inWeek.reduce((n, r) => n + r.effectiveReps, 0),
      sets: inWeek.reduce((n, r) => n + r.workingSets, 0),
    };
  });
  const peak = Math.max(1, ...bars.map((b) => b.er));
  const total = bars.reduce((n, b) => n + b.er, 0);
  const sets = picked.reduce((n, r) => n + r.workingSets, 0);
  const rated = picked.reduce((n, r) => n + r.ratedSets, 0);
  const trained = bars.filter((b) => b.sets > 0).length;

  return (
    <Panel>
      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {[ALL, ...muscles].map((m) => (
          <button
            key={m}
            onClick={() => pick(m)}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-sm font-semibold ${
              m === muscle
                ? "border-accent bg-accent text-black"
                : "border-line-2 bg-panel-2 text-ink-dim"
            }`}
          >
            {m === ALL ? "All muscles" : m}
          </button>
        ))}
      </div>

      <div className="flex h-32 items-end gap-1">
        {bars.map((b) => (
          <div key={b.week} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className={`display tnum text-[11px] font-semibold ${b.er > 0 ? "text-accent" : "text-ink-faint"}`}>
              {b.sets > 0 ? b.er : ""}
            </span>
            <div
              className={`w-full rounded-t-md transition-[height] duration-300 ${
                b.sets > 0 ? "bg-accent/80" : "bg-line"
              }`}
              style={{ height: `${b.sets > 0 ? Math.max(3, (b.er / peak) * 88) : 2}px` }}
              title={`${b.er} eff reps · ${b.sets} sets`}
            />
            <span className="text-[9px] text-ink-faint">
              {new Date(`${b.week}T00:00:00`).toLocaleDateString("en-US", {
                month: "numeric", day: "numeric",
              })}
            </span>
          </div>
        ))}
      </div>

      <p className="tnum mt-3 text-[11px] text-ink-faint">
        {sets === 0 ? (
          "Nothing logged in these weeks."
        ) : (
          <>
            <span className="text-ink">{total.toLocaleString("en-US")}</span> eff reps over{" "}
            {trained} of {weeks.length} weeks · {rated} of {sets} sets rated
          </>
        )}
      </p>
    </Panel>
  );
}
