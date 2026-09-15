/**
 * Reference bands from "Hypertrophy Training — Principles That Work"
 * (2026 Reference Edition, rev3), Vladimir's own document. Section 4 (Volume),
 * Section 5 (Effective Reps), Section 8 (Intensity) and the Quick Reference.
 *
 * These describe where a week or a session landed. They are the only "targets"
 * in the app and they never turn into a suggested load — the app still records
 * what happened and counts it; this is the ruler it is counted against.
 */

/** Hard working sets per muscle per week. */
export const WEEKLY_SETS_FLOOR = 5;          // below this: maintains at best
export const WEEKLY_SETS_LOW = 10;           // productive range
export const WEEKLY_SETS_HIGH = 16;

/** Effective reps per muscle per session, "conservative end for most". */
export const SESSION_ER_LOW = 20;
export const SESSION_ER_HIGH = 40;

/** Max effective working sets per muscle in one session. */
export const SESSION_SETS_MAX = 10;

/** Sessions per muscle per week. */
export const FREQUENCY_TARGET = 2;

/** A set counts as "hard" when it finished within this many reps of failure. */
export const HARD_SET_MAX_RIR = 3;

export type Band = "none" | "below" | "low" | "in" | "above";

/** Where a weekly set count sits against the paper's floor and productive range. */
export function weeklySetBand(sets: number): Band {
  if (sets <= 0) return "none";
  if (sets < WEEKLY_SETS_FLOOR) return "below";
  if (sets < WEEKLY_SETS_LOW) return "low";
  if (sets <= WEEKLY_SETS_HIGH) return "in";
  return "above";
}

/** Where a session's effective reps for one muscle sit against 20–40. */
export function sessionErBand(er: number): Band {
  if (er <= 0) return "none";
  if (er < SESSION_ER_LOW / 2) return "below";
  if (er < SESSION_ER_LOW) return "low";
  if (er <= SESSION_ER_HIGH) return "in";
  return "above";
}

export const BAND_LABEL: Record<Band, string> = {
  none: "nothing logged",
  below: "below floor",
  low: "under range",
  in: "in range",
  above: "over range",
};
