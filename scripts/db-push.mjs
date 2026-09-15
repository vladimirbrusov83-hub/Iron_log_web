// Applies db/schema.sql to DATABASE_URL, then seeds the exercise library and
// the three preset programs. Idempotent — safe to re-run.
//   npm run db:push
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { EXERCISES, PROGRAMS } from "../db/seed.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Put it in .env.local and try again.");
  process.exit(1);
}

const sql = neon(url);
const file = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

// The HTTP driver sends one statement per request, so the file is split rather
// than sent whole. Line comments go first so a "--" line can't hide a semicolon.
const statements = file
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  try {
    await sql.query(statement);
  } catch (err) {
    console.error(`\nFailed on:\n${statement}\n`);
    throw err;
  }
}

// ON CONFLICT against exercises_name_key, so re-running adds nothing and
// overwrites nothing someone renamed.
for (const [name, muscle, compound] of EXERCISES) {
  await sql`
    INSERT INTO exercises (name, muscle_group, is_compound, is_preset)
    VALUES (${name}, ${muscle}, ${compound}, true)
    ON CONFLICT (lower(name)) DO NOTHING`;
}

// Preset programs are seeded whole or not at all: if one already exists it is
// left exactly as it is, edits included. Re-running must never overwrite a day
// that was reordered or an exercise that was swapped out.
let seededPrograms = 0;
for (const program of PROGRAMS) {
  const existing = await sql`
    SELECT id FROM programs WHERE lower(name) = lower(${program.name}) AND is_preset`;
  if (existing.length > 0) continue;

  const [{ id: programId }] = await sql`
    INSERT INTO programs (name, description, is_preset)
    VALUES (${program.name}, ${program.description}, true)
    RETURNING id`;

  for (const [dayIndex, [dayName, exercises]] of program.days.entries()) {
    const [{ id: dayId }] = await sql`
      INSERT INTO program_days (program_id, name, position)
      VALUES (${programId}, ${dayName}, ${dayIndex})
      RETURNING id`;

    for (const [i, [name, sets, reps]] of exercises.entries()) {
      // The library row is looked up by name so the planned exercise keeps a
      // real foreign key. A name that isn't in the library still inserts — the
      // row carries its own name and muscle group.
      const [lib] = await sql`
        SELECT id, muscle_group FROM exercises WHERE lower(name) = lower(${name})`;
      await sql`
        INSERT INTO planned_exercises
          (day_id, exercise_id, name, muscle_group, position, planned_sets, planned_reps)
        VALUES (${dayId}, ${lib?.id ?? null}, ${name}, ${lib?.muscle_group ?? "Other"},
                ${i}, ${sets}, ${reps})`;
    }
  }
  seededPrograms++;
}

const [{ exercises }] = await sql`SELECT count(*)::int AS exercises FROM exercises`;
const [{ programs }] = await sql`SELECT count(*)::int AS programs FROM programs`;
console.log(
  `schema applied — ${statements.length} statements, ${exercises} exercises, ` +
  `${programs} programs (${seededPrograms} seeded this run)`,
);
