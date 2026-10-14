/**
 * Asserts the two forms of the effective-reps rule agree.
 *
 * `lib/effective-reps.ts` defines it twice — once as a TypeScript function the
 * log screen and history render through, once as `effectiveRepsSQL` the stats
 * aggregates sum in Postgres. They are the same rule written in two languages,
 * so they can drift, and a drift is invisible: both sides return a plausible
 * number and only disagree about which sets to count.
 *
 * With DATABASE_URL set, every case is evaluated in Postgres too and the two
 * answers are compared. Without it, only the TypeScript side is checked.
 *
 *   node --env-file-if-exists=.env.local scripts/check-effective-reps.mjs
 */
import { neon } from "@neondatabase/serverless";
import {
  countedSetSQL, effectiveReps, effectiveRepsByMuscle, effectiveRepsSQL, muscleCreditSQL,
} from "../lib/effective-reps.ts";

const set = (reps, rir, extra = {}) =>
  ({ reps, rir, isWarmup: false, isCompleted: true, ...extra });

const CASES = [
  [set(10, 0), 5, "taken to failure"],
  [set(10, 1), 4, "1 RIR"],
  [set(10, 2), 3, "2 RIR"],
  [set(10, 4), 1, "4 RIR — the last rating that counts"],
  [set(10, 5), null, "5+ RIR — too far from failure to count at all"],
  [set(3, 0), 3, "short set, capped at the reps actually done"],
  [set(1, 0), 1, "heavy single"],
  [set(0, 0), 0, "no reps"],
  [set(10, null), null, "not rated — unknown, not zero"],
  [set(10, 2, { isWarmup: true }), null, "warmup"],
  [set(10, 2, { isCompleted: false }), null, "not ticked off"],
  [set(10, null, { isWarmup: true }), null, "unrated warmup"],
  [set(10, 5, { isWarmup: true }), null, "easy warmup"],
  [set(8, 1, { restPauseReps: 6 }), 10, "rest-pause — activation 4 + all 6 mini-set reps"],
  [set(8, 0, { restPauseReps: 0 }), 5, "rest-pause switched off"],
  [set(8, 5, { restPauseReps: 6 }), null, "rest-pause at 5+ RIR — voids the whole set"],
  [set(8, null, { restPauseReps: 6 }), null, "rest-pause not rated"],
  [set(8, 2, { restPauseReps: 6, isCompleted: false }), null, "rest-pause not ticked off"],
];

let failures = 0;
const report = (ok, line) => { if (!ok) failures++; console.log(`${ok ? "ok  " : "FAIL"}  ${line}`); };

for (const [s, want, label] of CASES) {
  const got = effectiveReps(s);
  report(got === want, `ts   ${String(got).padStart(4)} (want ${want})  ${label}`);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("\nDATABASE_URL not set — skipped the SQL half of this check.");
} else {
  const sql = neon(url);

  // The trap this check exists for: Postgres least()/greatest() ignore NULL
  // arguments rather than propagating them, so `least(10, 5 - NULL)` is 10.
  const [guard] = await sql.query("SELECT least(10, NULL) AS value");
  console.log(
    `\nleast(10, NULL) = ${guard.value} — ` +
    `${guard.value === null ? "propagates" : "ignores NULL, so the rule must test it"}`,
  );

  const rows = CASES.map(([s], i) =>
    `(${i}, ${s.reps}, ${s.rir === null ? "NULL" : s.rir}, ${s.isWarmup}, ${s.isCompleted}, ` +
    `${s.restPauseReps ?? 0})`,
  ).join(", ");

  const result = await sql.query(
    `SELECT i, ${effectiveRepsSQL} AS score
       FROM (VALUES ${rows}) AS t(i, reps, rir, is_warmup, is_completed, rest_pause_reps)
      ORDER BY i`,
  );

  console.log();
  for (const row of result) {
    const [s, , label] = CASES[row.i];
    const ts = effectiveReps(s);
    const pg = row.score === null ? null : Number(row.score);
    report(pg === ts, `sql  ${String(pg).padStart(4)} (ts ${ts})  ${label}`);
  }

  /* Per muscle, with "Also works ½": effectiveRepsByMuscle (log screens) against
     muscleCreditSQL (stats). Bench with triceps + front delts, a helper repeated
     and one equal to the main muscle (both must count once), and a fly with none.
     Inline VALUES, so nothing is written to the real database. */
  const q = (v) => (v === null ? "NULL" : typeof v === "string" ? `'${v}'` : String(v));
  const arr = (list) => `ARRAY[${list.map(q).join(",")}]::text[]`;
  const lifts = [
    { muscleGroup: "Chest", secondaryMuscles: ["Triceps", "Front delts"],
      sets: [set(10, 1), set(10, 1), set(8, 0), set(10, 5), set(10, null)] },
    { muscleGroup: "Triceps", secondaryMuscles: ["Chest", "Chest", "Triceps"],
      sets: [set(12, 2), set(9, 1, { restPauseReps: 4 })] },
    { muscleGroup: "Chest", secondaryMuscles: [], sets: [set(15, 3)] },
  ];
  const logRows = lifts.map((l, i) => `(${i}, ${q(l.muscleGroup)}, ${arr(l.secondaryMuscles)})`).join(", ");
  const setRows = lifts.flatMap((l, i) => l.sets.map((s) =>
    `(${i}, ${s.reps}, ${q(s.rir)}::int, ${s.isWarmup}, ${s.isCompleted}, ${s.restPauseReps ?? 0})`)).join(", ");
  const pgRows = await sql.query(`
    WITH el0 (id, muscle_group, secondary_muscles) AS (VALUES ${logRows}),
         sl0 (exercise_log_id, reps, rir, is_warmup, is_completed, rest_pause_reps) AS (VALUES ${setRows})
    SELECT mc.credit_muscle AS muscle,
           coalesce(sum(mc.credit * (${effectiveRepsSQL})), 0) AS er,
           coalesce(sum(mc.credit) FILTER (WHERE ${countedSetSQL}), 0) AS working
      FROM el0 el JOIN sl0 sl ON sl.exercise_log_id = el.id
     CROSS JOIN LATERAL ${muscleCreditSQL} AS mc
     WHERE sl.is_completed GROUP BY 1`);
  console.log();
  for (const m of effectiveRepsByMuscle(lifts)) {
    const row = pgRows.find((r) => r.muscle === m.muscleGroup);
    const ok = row && Number(row.er) === m.effectiveReps && Number(row.working) === m.workingSets;
    report(ok, `muscle ${m.muscleGroup}: ts ${m.effectiveReps} er / ${m.workingSets} sets, ` +
      `sql ${row ? `${Number(row.er)} / ${Number(row.working)}` : "missing"}`);
  }
  report(pgRows.length === effectiveRepsByMuscle(lifts).length, `muscle rows: sql ${pgRows.length}`);
}

{
  const bench = effectiveRepsByMuscle([{ muscleGroup: "Chest", secondaryMuscles: ["Triceps", "Front delts"],
    sets: [set(10, 1), set(10, 1), set(8, 0), set(10, 5), set(10, null)] }]);
  const tri = bench.find((m) => m.muscleGroup === "Triceps");
  report(tri?.workingSets === 2 && tri?.effectiveReps === 6.5,
    `bench 4 working sets → triceps ${tri?.workingSets} sets, ${tri?.effectiveReps} er (want 2, 6.5)`);
}

console.log(failures === 0 ? "\nall pass" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
