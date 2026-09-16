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
import { effectiveReps, effectiveRepsSQL } from "../lib/effective-reps.ts";

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
    `(${i}, ${s.reps}, ${s.rir === null ? "NULL" : s.rir}, ${s.isWarmup}, ${s.isCompleted})`,
  ).join(", ");

  const result = await sql.query(
    `SELECT i, ${effectiveRepsSQL} AS score
       FROM (VALUES ${rows}) AS t(i, reps, rir, is_warmup, is_completed)
      ORDER BY i`,
  );

  console.log();
  for (const row of result) {
    const [s, , label] = CASES[row.i];
    const ts = effectiveReps(s);
    const pg = row.score === null ? null : Number(row.score);
    report(pg === ts, `sql  ${String(pg).padStart(4)} (ts ${ts})  ${label}`);
  }
}

console.log(failures === 0 ? "\nall pass" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
