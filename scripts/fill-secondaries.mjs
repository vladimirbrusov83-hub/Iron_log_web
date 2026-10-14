// One-off (Oct 2026): gives the library's compound lifts their "Also works ½"
// muscles, and carries them into program rows and logged history — so past
// bench sets start crediting triceps. Only rows still empty are touched, and a
// helper equal to the row's own main muscle is dropped. Not part of db:push:
// re-running would refill a helper that was cleared on purpose.
//   node --env-file=.env.local scripts/fill-secondaries.mjs [--dry]
import { neon } from "@neondatabase/serverless";
import { SECONDARY_MUSCLES } from "../db/seed.mjs";

const sql = neon(process.env.DATABASE_URL);
const dry = process.argv.includes("--dry");
const map = JSON.stringify(Object.entries(SECONDARY_MUSCLES).map(([name, sec]) => ({ name, sec })));

for (const table of ["exercises", "planned_exercises", "exercise_logs"]) {
  const where = `FROM json_to_recordset($1::json) AS m(name text, sec text[])
     WHERE lower(t.name) = lower(m.name) AND t.secondary_muscles = '{}'`;
  const [{ n }] = await sql.query(`SELECT count(*)::int AS n FROM ${table} t, json_to_recordset($1::json) AS m(name text, sec text[])
     WHERE lower(t.name) = lower(m.name) AND t.secondary_muscles = '{}'`, [map]);
  if (!dry) {
    await sql.query(`UPDATE ${table} t
        SET secondary_muscles = ARRAY(SELECT x FROM unnest(m.sec) AS x WHERE x <> t.muscle_group)
       ${where}`, [map]);
  }
  console.log(`${table}: ${n} row${n === 1 ? "" : "s"} ${dry ? "would get" : "got"} helpers`);
}
