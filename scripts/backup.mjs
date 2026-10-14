// Full copy of every table to backups/ironlog-<time>.json (gitignored — the
// repo is public). Run before any change that rewrites stored rows.
//   node --env-file=.env.local scripts/backup.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const TABLES = [
  "settings", "bodyweight_entries", "exercises", "programs", "program_days",
  "planned_exercises", "sessions", "exercise_logs", "set_logs", "personal_records",
];
const sql = neon(process.env.DATABASE_URL);
const out = { takenAt: new Date().toISOString(), tables: {} };
for (const t of TABLES) out.tables[t] = await sql.query(`SELECT * FROM ${t}`);

const dir = new URL("../backups/", import.meta.url);
mkdirSync(dir, { recursive: true });
const file = new URL(`ironlog-${out.takenAt.replace(/[:.]/g, "-")}.json`, dir);
writeFileSync(file, JSON.stringify(out));
console.log(file.pathname);
for (const t of TABLES) console.log(`  ${t}: ${out.tables[t].length}`);
