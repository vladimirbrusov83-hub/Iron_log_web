/**
 * Effective reps — the reps in a set that actually drove the adaptation.
 *
 * The idea behind the number: only the last few reps of a set, the ones taken
 * close to failure, recruit the high-threshold motor units that grow. Reps done
 * a long way from failure move the bar without doing much else. So a set is
 * scored by how close it finished to failure, which is exactly what RIR says.
 *
 *   effective reps = min(reps performed, THRESHOLD - RIR), never below zero
 *
 * At THRESHOLD = 5, a set taken to failure (RIR 0) scores 5; RIR 2 scores 3;
 * RIR 5 or more scores nothing. The `min` is what stops a 3-rep set at RIR 0
 * from being credited with 5 reps it never did.
 *
 * Three cases deliberately return null rather than a number, and the difference
 * matters everywhere this is summed:
 *
 *   - no RIR logged   → unknown, not zero. A set nobody rated says nothing
 *                       about proximity to failure, and counting it as 0 would
 *                       quietly drag every average down.
 *   - warmup set      → not part of the working stimulus, same as `volume`.
 *   - set not ticked  → it did not happen yet.
 *
 * Callers sum with `totalEffectiveReps`, which skips nulls. The SQL side has
 * the same rule written out in `effectiveRepsSQL` — change one, change both.
 */

/** Reps before failure that are treated as stimulating. */
export const EFFECTIVE_REP_THRESHOLD = 5;

/** The highest RIR the logger offers. 5 means "5 or more left in the tank" and
 *  is the only value that can score a set at zero effective reps. */
export const MAX_RIR = 5;

export type ScorableSet = {
  reps: number;
  rir: number | null;
  isWarmup: boolean;
  isCompleted: boolean;
};

/** Effective reps for one set, or null when the set cannot be scored. */
export function effectiveReps(set: ScorableSet): number | null {
  if (set.isWarmup || !set.isCompleted) return null;
  if (set.rir === null || !Number.isFinite(set.rir)) return null;
  const stimulating = EFFECTIVE_REP_THRESHOLD - set.rir;
  return Math.max(0, Math.min(set.reps, stimulating));
}

/** Sum over sets, skipping the ones that cannot be scored. */
export function totalEffectiveReps(sets: ScorableSet[]): number {
  return sets.reduce((sum, s) => sum + (effectiveReps(s) ?? 0), 0);
}

/** How many of the sets carried a score, and how many were working sets at all.
 *  The stats page shows this so a small total reads as "you didn't rate much"
 *  rather than as "you didn't work hard". */
export function effectiveRepsCoverage(sets: ScorableSet[]): {
  scored: number;
  working: number;
} {
  const working = sets.filter((s) => !s.isWarmup && s.isCompleted);
  return { scored: working.filter((s) => s.rir !== null).length, working: working.length };
}

/**
 * The same rule as an SQL expression, for aggregates that should not pull every
 * set row into Node.
 *
 * `rir IS NULL` has to be tested explicitly. Postgres `least` and `greatest`
 * *ignore* NULL arguments instead of propagating them, so without that test
 * `least(reps, 5 - NULL)` collapses to `reps` and an unrated 10-rep set scores
 * 10 here while `effectiveReps` above scores it null. Every stats total would
 * read higher than the log screen, and the "x of y sets rated" line printed
 * beside it would be describing a number that had already counted all y.
 *
 * `scripts/check-effective-reps.mjs` asserts the two forms agree.
 */
export const effectiveRepsSQL = `
  CASE WHEN is_warmup OR NOT is_completed OR rir IS NULL THEN NULL
       ELSE greatest(0, least(reps, ${EFFECTIVE_REP_THRESHOLD} - rir))
  END`;

/** Wording for one set's score, used on the set row and in history. */
export function effectiveRepsLabel(set: ScorableSet): string {
  const value = effectiveReps(set);
  return value === null ? "—" : `${value}`;
}

/* ------------------------------------------------------------ by muscle */

export type MuscleSlice = {
  muscleGroup: string;
  effectiveReps: number;
  workingSets: number;
  scoredSets: number;
};

/** Effective reps and set counts per muscle group for a set of exercise logs,
 *  biggest first. Same null rules as everything above. */
export function effectiveRepsByMuscle(
  exercises: { muscleGroup: string; sets: ScorableSet[] }[],
): MuscleSlice[] {
  const map = new Map<string, MuscleSlice>();
  for (const ex of exercises) {
    const slice = map.get(ex.muscleGroup) ?? {
      muscleGroup: ex.muscleGroup, effectiveReps: 0, workingSets: 0, scoredSets: 0,
    };
    for (const s of ex.sets) {
      if (s.isWarmup || !s.isCompleted) continue;
      slice.workingSets += 1;
      const er = effectiveReps(s);
      if (er !== null) { slice.scoredSets += 1; slice.effectiveReps += er; }
    }
    map.set(ex.muscleGroup, slice);
  }
  return [...map.values()]
    .filter((m) => m.workingSets > 0)
    .sort((a, b) => b.effectiveReps - a.effectiveReps || b.workingSets - a.workingSets);
}
