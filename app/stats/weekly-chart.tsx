"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import type { WeeklyMuscleRow } from "@/lib/db";
import { MUSCLE_GROUPS } from "@/lib/types";

const ALL = "All";
const STORE_KEY = "ironlog.stats.muscle";

/**
 * One chart, one muscle at a time: effective reps per week over the last
 * twelve weeks as connected dots, empty weeks breaking the line. The chip row picks the muscle;
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
  const points = bars.map((b, i) => ({
    ...b,
    x: ((i + 0.5) / bars.length) * 100,
    y: b.sets > 0 ? 100 - (b.er / peak) * 100 : 100,
  }));
  // A week with nothing logged for the muscle breaks the line rather than
  // diving to zero — it shows as a small grey dot on the baseline instead.
  const segments: (typeof points)[] = [];
  let run: typeof points = [];
  for (const p of points) {
    if (p.sets > 0) run.push(p);
    else if (run.length) { segments.push(run); run = []; }
  }
  if (run.length) segments.push(run);
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

      {/* Line and dots share one coordinate space: x is the week's column centre,
          y is the share of the peak. The SVG stretches to fit (the stroke does not
          scale); dots and numbers are HTML on top so they stay round and crisp. */}
      <div className="relative mt-5 h-28">
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <line x1="0" x2="100" y1="100" y2="100" className="stroke-line" strokeWidth="1"
            vectorEffect="non-scaling-stroke" />
          {segments.map((seg, i) => (
            <polyline
              key={i}
              points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              className="stroke-accent"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {points.map((p) => (
          <div
            key={p.week}
            className="absolute -translate-x-1/2 translate-y-1/2"
            style={{ left: `${p.x}%`, bottom: `${100 - p.y}%` }}
            title={`${p.er} eff reps · ${p.sets} sets`}
          >
            {p.sets > 0 ? (
              <>
                <span className="display tnum absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[11px] font-semibold text-accent">
                  {p.er}
                </span>
                <span className="block size-2.5 rounded-full border-2 border-accent bg-panel" />
              </>
            ) : (
              <span className="block size-1.5 rounded-full bg-line-2" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex">
        {points.map((p) => (
          <span key={p.week} className="flex-1 text-center text-[9px] text-ink-faint">
            {new Date(`${p.week}T00:00:00`).toLocaleDateString("en-US", {
              month: "numeric", day: "numeric",
            })}
          </span>
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
