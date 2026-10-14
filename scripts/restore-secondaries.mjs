// Puts every row's "Also works ½" muscles back to what a backup file holds,
// by id — the undo for fill-secondaries.mjs or a bad edit. Touches nothing else.
// Rows the backup does not know (created since) are left alone.
//   node --env-file=.env.local scripts/restore-secondaries.mjs backups/ironlog-….json [--dry]
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const path = process.argv[2];
const dry = process.argv.includes("--dry");
if (!path) { console.error("Give the backup file."); process.exit(1); }
const backup = JSON.parse(readFileSync(path, "utf8"));
const sql = neon(process.env.DATABASE_URL);

for (const t of ["exercises", "planned_exercises", "exercise_logs"]) {
  const rows = backup.tables[t].map((r) => ({ id: r.id, sec: r.secondary_muscles ?? [] }));
  const match = `FROM json_to_recordset($1::json) AS b(id uuid, sec text[])
      WHERE x.id = b.id AND x.secondary_muscles IS DISTINCT FROM b.sec`;
  const res = await sql.query(dry
    ? `SELECT x.id FROM ${t} AS x, json_to_recordset($1::json) AS b(id uuid, sec text[])
        WHERE x.id = b.id AND x.secondary_muscles IS DISTINCT FROM b.sec`
    : `UPDATE ${t} AS x SET secondary_muscles = b.sec ${match} RETURNING x.id`,
    [JSON.stringify(rows)]);
  console.log(`${t}: ${res.length} row${res.length === 1 ? "" : "s"} ${dry ? "would be" : ""} restored`);
}
