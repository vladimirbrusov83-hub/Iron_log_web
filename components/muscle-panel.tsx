"use client";

import { useState } from "react";
import { BAND_COLOR, GlideBar } from "@/components/ui";
import { RollingNumber, useSideSwipe } from "@/components/animated";
import type { MuscleSlice } from "@/lib/effective-reps";
import {
  SESSION_ER_HIGH, SESSION_ER_LOW, WEEKLY_ER_HIGH, WEEKLY_ER_LOW, WEEKLY_SETS_LOW, WEEKLY_SETS_HIGH,
  sessionErBand, weeklyErBand, weeklySetBand,
} from "@/lib/targets";

export type PreviousWorkout = { dayName: string; startedAt: string; byMuscle: MuscleSlice[] };
export type LastWeekRow = {
  muscleGroup: string; effectiveReps: number; workingSets: number; hardSets: number; sessions: number;
};
export type LastWeek = { weekStart: string; rows: LastWeekRow[] };

/**
 * Effective reps per muscle behind the ⋯ button.
 *
 * Nov 13 2026 (Vladimir): the lift screen keeps only Last workout | This workout;
 * the session list (`/log/[id]`) got its own ⋯ with all four tabs. Pass the
 * weeks to get the week tabs, leave them out for the two-tab version.
 *
 * Four tabs ordered like the set
 * columns (older on the left): the workout before this one (last run of the same
 * program day, else the most recent), last Monday–Sunday, this Monday–Sunday (this
 * workout included, added Nov 2026), and this workout so far.
 * Last workout came in September 2026, Last week in October.
 *
 * Since November 2026 it works like the home drawer: one list in one muscle order
 * for all tabs (every muscle in any of them, zeros where a tab has none), and
 * a sideways swipe or a tab tap only rolls the numbers and glides the bars — the
 * names and bars never move. Workout tabs are coloured against the paper's 20–40
 * per session, the week against 40–80 a week, hard sets against 10–16 a week.
 * They describe what happened; they never suggest a load.
 */
type PanelTab = "last" | "week" | "thisWeek" | "today";

export function MusclePanel({
  byMuscle, previous, lastWeek, thisWeek, current,
}: {
  byMuscle: MuscleSlice[]; previous: PreviousWorkout | null;
  lastWeek?: LastWeek; thisWeek?: LastWeek; current?: string;
}) {
  const [tab, setTab] = useState<PanelTab>("today");
  const weeks = !!(lastWeek && thisWeek);
  const tabs: PanelTab[] = [
    ...(previous ? ["last" as const] : []),
    ...(weeks ? ["week" as const, "thisWeek" as const] : []),
    "today",
  ];
  const swipe = useSideSwipe((dir) => {
    // The highlight follows the finger: swipe left → the tab to the left,
    // right → the tab to the right; endless, wraps round at both ends
    // (Vladimir flipped it Nov 7, 2026 — it used to run against the finger).
    const n = tabs.length;
    setTab(tabs[(((tabs.indexOf(tab) + dir) % n) + n) % n]);
  });

  const today = new Map(byMuscle.map((m) => [m.muscleGroup, m]));
  const last = new Map((previous?.byMuscle ?? []).map((m) => [m.muscleGroup, m]));
  const lastWk = new Map((lastWeek?.rows ?? []).map((m) => [m.muscleGroup, m]));
  const thisWk = new Map((thisWeek?.rows ?? []).map((m) => [m.muscleGroup, m]));
  const er = (m: { effectiveReps: number } | undefined) => m?.effectiveReps ?? 0;
  const order = [...new Set([...today.keys(), ...last.keys(), ...lastWk.keys(), ...thisWk.keys()])].sort((a, b) =>
    er(today.get(b)) - er(today.get(a)) || er(last.get(b)) - er(last.get(a)) ||
    er(thisWk.get(b)) - er(thisWk.get(a)) || er(lastWk.get(b)) - er(lastWk.get(a)) || a.localeCompare(b));

  const day = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const lastLabel = previous ? day(new Date(previous.startedAt)) : null;
  const range = (w: LastWeek | undefined) => {
    if (!w) return "";
    const start = new Date(`${w.weekStart}T12:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${day(start)} – ${day(end)}`;
  };
  const subtitle = tab === "today" ? "This workout so far"
    : tab === "last" ? previous?.dayName ?? ""
    : tab === "thisWeek" ? `${range(thisWeek)} · this workout included`
    : range(lastWeek);

  const tabClass = (on: boolean) =>
    `flex-1 whitespace-nowrap rounded-md px-1 py-1.5 text-xs font-semibold transition-colors duration-300 ${
      on ? "bg-panel-3 text-ink" : "text-ink-faint"
    }`;
  return (
    <div style={swipe.style} onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
      <div className="mb-2.5 flex gap-1 rounded-lg bg-panel-2 p-1" role="tablist">
        <button role="tab" aria-selected={tab === "last"} className={tabClass(tab === "last")}
          onClick={() => setTab("last")} disabled={!previous}>
          {previous ? (weeks ? `Last · ${lastLabel}` : `Last workout · ${lastLabel}`) : "No last"}
        </button>
        {weeks && (<>
          <button role="tab" aria-selected={tab === "week"} className={tabClass(tab === "week")}
            onClick={() => setTab("week")}>
            Last week
          </button>
          <button role="tab" aria-selected={tab === "thisWeek"} className={tabClass(tab === "thisWeek")}
            onClick={() => setTab("thisWeek")}>
            This week
          </button>
        </>)}
        <button role="tab" aria-selected={tab === "today"} className={tabClass(tab === "today")}
          onClick={() => setTab("today")}>
          This workout
        </button>
      </div>
      <p className="mb-2 truncate text-xs text-ink-faint">{subtitle}</p>
      {order.length === 0 ? (
        <p className="text-xs text-ink-faint">No working sets logged yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {order.map((name) => {
            const isWeek = tab === "week" || tab === "thisWeek";
            const w = (tab === "thisWeek" ? thisWk : lastWk).get(name);
            const s = (tab === "last" ? last : today).get(name);
            const value = isWeek ? er(w) : er(s);
            const band = isWeek ? weeklyErBand(value) : sessionErBand(value);
            return (
              <li key={name}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={name === current ? "font-semibold text-ink" : "text-ink-dim"}>
                    {name}
                  </span>
                  <span className="tnum shrink-0 text-xs text-ink-faint">
                    <span className={`display text-base font-semibold transition-colors duration-500 ${BAND_COLOR[band]}`}>
                      <RollingNumber value={value} />
                    </span>
                    {isWeek ? (<>
                      {" · "}
                      <span className={`transition-colors duration-500 ${BAND_COLOR[weeklySetBand(w?.hardSets ?? 0)]}`}>
                        <RollingNumber value={w?.hardSets ?? 0} /> hard
                      </span>
                      {" / "}<RollingNumber value={w?.workingSets ?? 0} /> sets · {w?.sessions ?? 0}×
                    </>) : (<>
                      {" · "}<RollingNumber value={s?.scoredSets ?? 0} /> of{" "}
                      <RollingNumber value={s?.workingSets ?? 0} /> sets rated
                    </>)}
                  </span>
                </div>
                <div className="mt-1">
                  {isWeek
                    ? <GlideBar value={value} band={band} scale={100} low={WEEKLY_ER_LOW} high={WEEKLY_ER_HIGH} />
                    : <GlideBar value={value} band={band} scale={50} low={SESSION_ER_LOW} high={SESSION_ER_HIGH} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2.5 text-[11px] text-ink-faint">
        {tab === "week" || tab === "thisWeek"
          ? `Shaded: ${WEEKLY_ER_LOW}–${WEEKLY_ER_HIGH} effective reps a week. Hard sets against ${WEEKLY_SETS_LOW}–${WEEKLY_SETS_HIGH}.`
          : `Shaded: ${SESSION_ER_LOW}–${SESSION_ER_HIGH} effective reps per muscle per session.`}
      </p>
    </div>
  );
}
