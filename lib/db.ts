import { neon } from "@neondatabase/serverless";
import { countedSetSQL, effectiveRepsSQL } from "./effective-reps";
import { HARD_SET_MAX_RIR } from "./targets";
import { estimated1RM } from "./types";
import type {
  BodyweightEntry, Exercise, ExerciseLog, PersonalRecord, Program, ProgramDay,
  Session, SetLog, Settings, WeightUnit,
} from "./types";

type Neon = ReturnType<typeof neon>;
let client: Neon | undefined;

/**
 * Built on first query, not at import time. `next build` loads every route
 * module even though they are all dynamic, so connecting at import would make
 * the build fail on a machine that has no DATABASE_URL.
 */
function connect(): Neon {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set — see .env.example");
    client = neon(url);
  }
  return client;
}

export const sql = new Proxy((() => {}) as unknown as Neon, {
  apply: (_t, _this, args) => Reflect.apply(connect() as never, undefined, args),
  get: (_t, prop) => Reflect.get(connect() as never, prop),
});

/* --------------------------------------------------------------- settings */

export async function getSettings(): Promise<Settings> {
  const rows = (await sql`
    SELECT weight_unit, default_rest_seconds, track_rir FROM settings WHERE id = 1`) as {
    weight_unit: WeightUnit; default_rest_seconds: number; track_rir: boolean;
  }[];
  const row = rows[0];
  // A missing row means db:push has not run. Defaults keep every screen
  // rendering rather than throwing on the way in.
  if (!row) return { weightUnit: "kg", defaultRestSeconds: 90, trackRir: true };
  return {
    weightUnit: row.weight_unit,
    defaultRestSeconds: row.default_rest_seconds,
    trackRir: row.track_rir,
  };
}

export async function updateSettings(s: Settings): Promise<void> {
  await sql`
    UPDATE settings
       SET weight_unit = ${s.weightUnit},
           default_rest_seconds = ${s.defaultRestSeconds},
           track_rir = ${s.trackRir}
     WHERE id = 1`;
}

/* -------------------------------------------------------------- exercises */

export async function getExercises(): Promise<Exercise[]> {
  const rows = (await sql`
    SELECT id, name, muscle_group, is_compound, notes, is_preset
      FROM exercises ORDER BY muscle_group, name`) as {
    id: string; name: string; muscle_group: string;
    is_compound: boolean; notes: string; is_preset: boolean;
  }[];
  return rows.map((r) => ({
    id: r.id, name: r.name, muscleGroup: r.muscle_group,
    isCompound: r.is_compound, notes: r.notes, isPreset: r.is_preset,
  }));
}

/**
 * How much each library entry is actually used: how many programs plan it and
 * how many sessions contain it. Matched on the name, which is unique in the
 * library case-insensitively, so a lift logged as a one-off still counts.
 *
 * The exercises page shows this beside every row, because deleting a lift you
 * have trained for a year and deleting a typo you saved by accident should not
 * look identical.
 */
export type ExerciseUsage = { programs: number; sessions: number };

export async function getExerciseUsage(): Promise<Record<string, ExerciseUsage>> {
  const rows = (await sql`
    SELECT e.id,
           (SELECT count(DISTINCT d.program_id)
              FROM planned_exercises pe
              JOIN program_days d ON d.id = pe.day_id
             WHERE lower(pe.name) = lower(e.name)) AS programs,
           (SELECT count(DISTINCT el.session_id)
              FROM exercise_logs el
             WHERE lower(el.name) = lower(e.name)) AS sessions
      FROM exercises e`) as { id: string; programs: string; sessions: string }[];
  return Object.fromEntries(rows.map((r) => [
    r.id, { programs: Number(r.programs), sessions: Number(r.sessions) },
  ]));
}

/** Returns null when the name is already taken — the unique index is
 *  case-insensitive, so "bench press" collides with "Bench Press". */
export async function addExercise(
  name: string, muscleGroup: string, isCompound: boolean, notes = "",
): Promise<string | null> {
  const rows = (await sql`
    INSERT INTO exercises (name, muscle_group, is_compound, notes)
    VALUES (${name.trim()}, ${muscleGroup}, ${isCompound}, ${notes})
    ON CONFLICT (lower(name)) DO NOTHING
    RETURNING id`) as { id: string }[];
  return rows[0]?.id ?? null;
}

export async function updateExercise(
  id: string, name: string, muscleGroup: string, isCompound: boolean, notes: string,
): Promise<void> {
  await sql`
    UPDATE exercises
       SET name = ${name.trim()}, muscle_group = ${muscleGroup},
           is_compound = ${isCompound}, notes = ${notes}
     WHERE id = ${id}`;
}

/**
 * The standing note on a lift, for the gym screen.
 *
 * Matched on the **name**, not on `exercise_id`: that column is
 * `ON DELETE SET NULL` and a one-off log never had one, which is the same
 * reason `getExerciseUsage` and `getLastSessionSets` match on the name. A lift
 * logged as a one-off today therefore picks the note up by itself once it is
 * added to the library.
 *
 * Null means there is no library row — there is nowhere to keep a note, and the
 * gym screen shows no box rather than one that quietly loses what is typed.
 */
export type ExerciseNote = { id: string; notes: string };

export async function getExerciseNote(name: string): Promise<ExerciseNote | null> {
  const rows = (await sql`
    SELECT id, notes FROM exercises WHERE lower(name) = lower(${name}) LIMIT 1`
  ) as { id: string; notes: string }[];
  return rows[0] ?? null;
}

/** Notes only. `updateExercise` writes the name, group and compound flag too,
 *  so calling it from the gym would push three stale values over a library
 *  edit made in between. */
export async function saveExerciseNote(id: string, notes: string): Promise<void> {
  await sql`UPDATE exercises SET notes = ${notes} WHERE id = ${id}`;
}

/** Programs and history keep their own copy of the name, so deleting a lift
 *  here empties the link and leaves every past session readable. */
export async function deleteExercise(id: string): Promise<void> {
  await sql`DELETE FROM exercises WHERE id = ${id}`;
}

/* --------------------------------------------------------------- programs */

type ProgramRow = {
  id: string; name: string; description: string;
  is_pinned: boolean; is_preset: boolean;
};

/** Loads whole programs — days and planned exercises included — in three
 *  queries regardless of how many programs match. */
async function hydratePrograms(programRows: ProgramRow[]): Promise<Program[]> {
  if (programRows.length === 0) return [];
  const ids = programRows.map((p) => p.id);

  const dayRows = (await sql`
    SELECT id, program_id, name, position FROM program_days
     WHERE program_id = ANY(${ids}::uuid[]) ORDER BY program_id, position`) as {
    id: string; program_id: string; name: string; position: number;
  }[];

  const dayIds = dayRows.map((d) => d.id);
  const exRows = dayIds.length === 0 ? [] : ((await sql`
    SELECT id, day_id, exercise_id, name, muscle_group, position, planned_sets, planned_reps
      FROM planned_exercises WHERE day_id = ANY(${dayIds}::uuid[])
     ORDER BY day_id, position`) as {
    id: string; day_id: string; exercise_id: string | null; name: string;
    muscle_group: string; position: number; planned_sets: number; planned_reps: number;
  }[]);

  const exByDay = new Map<string, ProgramDay["exercises"]>();
  for (const e of exRows) {
    const list = exByDay.get(e.day_id) ?? [];
    list.push({
      id: e.id, exerciseId: e.exercise_id, name: e.name, muscleGroup: e.muscle_group,
      position: e.position, plannedSets: e.planned_sets, plannedReps: e.planned_reps,
    });
    exByDay.set(e.day_id, list);
  }

  const daysByProgram = new Map<string, ProgramDay[]>();
  for (const d of dayRows) {
    const list = daysByProgram.get(d.program_id) ?? [];
    list.push({ id: d.id, name: d.name, position: d.position, exercises: exByDay.get(d.id) ?? [] });
    daysByProgram.set(d.program_id, list);
  }

  return programRows.map((p) => ({
    id: p.id, name: p.name, description: p.description,
    isPinned: p.is_pinned, isPreset: p.is_preset,
    days: daysByProgram.get(p.id) ?? [],
  }));
}

export async function getPrograms(): Promise<Program[]> {
  const rows = (await sql`
    SELECT id, name, description, is_pinned, is_preset FROM programs
     ORDER BY is_pinned DESC, created_at`) as ProgramRow[];
  return hydratePrograms(rows);
}

/**
 * Programs with the one trained most recently first — the order the home screen
 * swipes through, so the program you are actually running is the one already on
 * screen. Programs never started fall in behind, pinned first.
 */
export async function getProgramsByRecentUse(): Promise<Program[]> {
  const rows = (await sql`
    SELECT p.id, p.name, p.description, p.is_pinned, p.is_preset
      FROM programs p
      LEFT JOIN (
        SELECT program_id, max(started_at) AS last_used
          FROM sessions WHERE program_id IS NOT NULL GROUP BY program_id
      ) u ON u.program_id = p.id
     ORDER BY u.last_used DESC NULLS LAST, p.is_pinned DESC, p.created_at`) as ProgramRow[];
  return hydratePrograms(rows);
}

export async function getProgram(id: string): Promise<Program | null> {
  const rows = (await sql`
    SELECT id, name, description, is_pinned, is_preset
      FROM programs WHERE id = ${id}`) as ProgramRow[];
  return (await hydratePrograms(rows))[0] ?? null;
}

export async function getProgramDay(dayId: string): Promise<
  { day: ProgramDay; programId: string; programName: string } | null
> {
  const rows = (await sql`
    SELECT d.id, d.name, d.position, p.id AS program_id, p.name AS program_name
      FROM program_days d JOIN programs p ON p.id = d.program_id
     WHERE d.id = ${dayId}`) as {
    id: string; name: string; position: number;
    program_id: string; program_name: string;
  }[];
  const row = rows[0];
  if (!row) return null;

  const exRows = (await sql`
    SELECT id, exercise_id, name, muscle_group, position, planned_sets, planned_reps
      FROM planned_exercises WHERE day_id = ${dayId} ORDER BY position`) as {
    id: string; exercise_id: string | null; name: string; muscle_group: string;
    position: number; planned_sets: number; planned_reps: number;
  }[];

  return {
    programId: row.program_id,
    programName: row.program_name,
    day: {
      id: row.id, name: row.name, position: row.position,
      exercises: exRows.map((e) => ({
        id: e.id, exerciseId: e.exercise_id, name: e.name, muscleGroup: e.muscle_group,
        position: e.position, plannedSets: e.planned_sets, plannedReps: e.planned_reps,
      })),
    },
  };
}

/** When each day of a program was last trained, keyed by day id. Sessions keep
 *  `day_id` with ON DELETE SET NULL, so a day edited away simply has no entry. */
export async function getLastDayUse(programId: string | null): Promise<Record<string, string>> {
  if (!programId) return {};
  const rows = (await sql`
    SELECT day_id, max(started_at)::text AS last_used
      FROM sessions
     WHERE program_id = ${programId} AND day_id IS NOT NULL AND finished_at IS NOT NULL
     GROUP BY day_id`) as { day_id: string; last_used: string }[];
  return Object.fromEntries(rows.map((r) => [r.day_id, r.last_used]));
}

export type ProgramInput = {
  id: string | null;
  name: string;
  description: string;
  days: {
    name: string;
    exercises: {
      exerciseId: string | null; name: string; muscleGroup: string;
      plannedSets: number; plannedReps: number;
    }[];
  }[];
};

/**
 * Saves a whole program, replacing its days outright.
 *
 * Days are deleted and reinserted rather than matched up, which is safe here
 * in a way it would not be for sessions: a program day owns nothing a person
 * typed except its own name and exercise list, both of which arrive in the
 * draft. Sessions reference `day_id` with ON DELETE SET NULL, so editing a
 * program detaches old sessions from the day without touching what was logged —
 * every session keeps its own `day_name` snapshot and still reads correctly.
 */
export async function saveProgram(draft: ProgramInput): Promise<string> {
  const programId = draft.id ?? crypto.randomUUID();

  if (draft.id) {
    await sql`
      UPDATE programs SET name = ${draft.name}, description = ${draft.description}
       WHERE id = ${programId}`;
    await sql`DELETE FROM program_days WHERE program_id = ${programId}`;
  } else {
    await sql`
      INSERT INTO programs (id, name, description)
      VALUES (${programId}, ${draft.name}, ${draft.description})`;
  }

  // Ids generated here rather than by the database, so days and their exercises
  // go up in one transaction with no round-trip in between.
  const statements = [];
  for (const [dayIndex, day] of draft.days.entries()) {
    const dayId = crypto.randomUUID();
    statements.push(sql`
      INSERT INTO program_days (id, program_id, name, position)
      VALUES (${dayId}, ${programId}, ${day.name}, ${dayIndex})`);
    for (const [i, ex] of day.exercises.entries()) {
      statements.push(sql`
        INSERT INTO planned_exercises
          (day_id, exercise_id, name, muscle_group, position, planned_sets, planned_reps)
        VALUES (${dayId}, ${ex.exerciseId}::uuid, ${ex.name}, ${ex.muscleGroup},
                ${i}, ${ex.plannedSets}, ${ex.plannedReps})`);
    }
  }
  if (statements.length > 0) await sql.transaction(statements);
  return programId;
}

/* One day at a time — the editor is per-day now, so these touch a single day
   and leave the rest of the program alone. Unlike `saveProgram`, `program_days`
   rows keep their ids, so sessions started from a day stay attached to it. */

export async function createProgram(name: string, description: string): Promise<string> {
  const rows = (await sql`
    INSERT INTO programs (name, description) VALUES (${name}, ${description})
    RETURNING id`) as { id: string }[];
  return rows[0].id;
}

export async function updateProgramMeta(
  id: string, name: string, description: string,
): Promise<void> {
  await sql`UPDATE programs SET name = ${name}, description = ${description} WHERE id = ${id}`;
}

export async function addProgramDay(programId: string, name: string): Promise<string> {
  const rows = (await sql`
    INSERT INTO program_days (program_id, name, position)
    SELECT ${programId}, ${name}, coalesce(max(position), -1) + 1
      FROM program_days WHERE program_id = ${programId}
    RETURNING id`) as { id: string }[];
  return rows[0].id;
}

export async function deleteProgramDay(dayId: string): Promise<void> {
  await sql`DELETE FROM program_days WHERE id = ${dayId}`;
}

export async function reorderProgramDays(programId: string, dayIds: string[]): Promise<void> {
  if (dayIds.length === 0) return;
  await sql`
    UPDATE program_days AS d
       SET position = o.position
      FROM unnest(${dayIds}::uuid[]) WITH ORDINALITY AS o(id, position)
     WHERE d.id = o.id AND d.program_id = ${programId}`;
}

export type PlannedInput = {
  exerciseId: string | null; name: string; muscleGroup: string;
  plannedSets: number; plannedReps: number;
};

/**
 * Replaces one day's name and planned exercises.
 *
 * The planned rows are deleted and reinserted rather than matched up, which is
 * safe: nothing references them. A session copies what it needs at the moment it
 * starts and keeps its own rows afterwards.
 */
export async function saveProgramDay(
  dayId: string, name: string, exercises: PlannedInput[],
): Promise<void> {
  const statements = [
    sql`UPDATE program_days SET name = ${name} WHERE id = ${dayId}`,
    sql`DELETE FROM planned_exercises WHERE day_id = ${dayId}`,
  ];
  for (const [i, ex] of exercises.entries()) {
    statements.push(sql`
      INSERT INTO planned_exercises
        (day_id, exercise_id, name, muscle_group, position, planned_sets, planned_reps)
      VALUES (${dayId}, ${ex.exerciseId}::uuid, ${ex.name}, ${ex.muscleGroup},
              ${i}, ${ex.plannedSets}, ${ex.plannedReps})`);
  }
  await sql.transaction(statements);
}

export async function deleteProgram(id: string): Promise<void> {
  await sql`DELETE FROM programs WHERE id = ${id}`;
}

/** One pinned program at a time — it is the one the home screen offers. */
export async function pinProgram(id: string): Promise<void> {
  await sql.transaction([
    sql`UPDATE programs SET is_pinned = false WHERE is_pinned`,
    sql`UPDATE programs SET is_pinned = true WHERE id = ${id}`,
  ]);
}

export async function unpinProgram(id: string): Promise<void> {
  await sql`UPDATE programs SET is_pinned = false WHERE id = ${id}`;
}

export async function duplicateProgram(id: string): Promise<string | null> {
  const src = await getProgram(id);
  if (!src) return null;
  return saveProgram({
    id: null,
    name: `${src.name} (copy)`,
    description: src.description,
    days: src.days.map((d) => ({
      name: d.name,
      exercises: d.exercises.map((e) => ({
        exerciseId: e.exerciseId, name: e.name, muscleGroup: e.muscleGroup,
        plannedSets: e.plannedSets, plannedReps: e.plannedReps,
      })),
    })),
  });
}

/* --------------------------------------------------------------- sessions */

type SessionRow = {
  id: string; started_at: string; finished_at: string | null; day_name: string;
  program_name: string; program_id: string | null; day_id: string | null;
  duration_seconds: number; notes: string;
};

/** Loads whole sessions — exercise logs and every set — in three queries. */
async function hydrateSessions(sessionRows: SessionRow[]): Promise<Session[]> {
  if (sessionRows.length === 0) return [];
  const ids = sessionRows.map((s) => s.id);

  const logRows = (await sql`
    SELECT id, session_id, exercise_id, name, muscle_group, position, notes,
           planned_sets, planned_reps
      FROM exercise_logs WHERE session_id = ANY(${ids}::uuid[])
     ORDER BY session_id, position`) as {
    id: string; session_id: string; exercise_id: string | null; name: string;
    muscle_group: string; position: number; notes: string;
    planned_sets: number; planned_reps: number;
  }[];

  const logIds = logRows.map((l) => l.id);
  const setRows = logIds.length === 0 ? [] : ((await sql`
    SELECT id, exercise_log_id, set_number, weight, reps, rir, rpe, notes,
           is_completed, is_warmup
      FROM set_logs WHERE exercise_log_id = ANY(${logIds}::uuid[])
     ORDER BY exercise_log_id, set_number`) as {
    id: string; exercise_log_id: string; set_number: number; weight: number;
    reps: number; rir: number | null; rpe: number | null; notes: string;
    is_completed: boolean; is_warmup: boolean;
  }[]);

  const setsByLog = new Map<string, SetLog[]>();
  for (const s of setRows) {
    const list = setsByLog.get(s.exercise_log_id) ?? [];
    list.push({
      id: s.id, setNumber: s.set_number, weight: s.weight, reps: s.reps,
      rir: s.rir, rpe: s.rpe, notes: s.notes,
      isCompleted: s.is_completed, isWarmup: s.is_warmup,
    });
    setsByLog.set(s.exercise_log_id, list);
  }

  const logsBySession = new Map<string, ExerciseLog[]>();
  for (const l of logRows) {
    const list = logsBySession.get(l.session_id) ?? [];
    list.push({
      id: l.id, exerciseId: l.exercise_id, name: l.name, muscleGroup: l.muscle_group,
      position: l.position, notes: l.notes, plannedSets: l.planned_sets,
      plannedReps: l.planned_reps, sets: setsByLog.get(l.id) ?? [],
    });
    logsBySession.set(l.session_id, list);
  }

  return sessionRows.map((s) => ({
    id: s.id, startedAt: s.started_at, finishedAt: s.finished_at,
    dayName: s.day_name, programName: s.program_name, programId: s.program_id,
    dayId: s.day_id, durationSeconds: s.duration_seconds, notes: s.notes,
    exercises: logsBySession.get(s.id) ?? [],
  }));
}

/** The workout in progress, if there is one. The partial unique index in the
 *  schema is what guarantees there is at most one. */
export async function getActiveSession(): Promise<Session | null> {
  const rows = (await sql`
    SELECT id, started_at, finished_at, day_name, program_name, program_id,
           day_id, duration_seconds, notes
      FROM sessions WHERE finished_at IS NULL`) as SessionRow[];
  return (await hydrateSessions(rows))[0] ?? null;
}

export async function getSession(id: string): Promise<Session | null> {
  const rows = (await sql`
    SELECT id, started_at, finished_at, day_name, program_name, program_id,
           day_id, duration_seconds, notes
      FROM sessions WHERE id = ${id}`) as SessionRow[];
  return (await hydrateSessions(rows))[0] ?? null;
}

export async function getFinishedSessions(limit = 50): Promise<Session[]> {
  const rows = (await sql`
    SELECT id, started_at, finished_at, day_name, program_name, program_id,
           day_id, duration_seconds, notes
      FROM sessions WHERE finished_at IS NOT NULL
     ORDER BY started_at DESC LIMIT ${limit}`) as SessionRow[];
  return hydrateSessions(rows);
}

/**
 * Starts a workout, optionally from a program day — in which case every planned
 * exercise is copied in with its planned sets already laid out as empty rows,
 * so the gym screen opens on something to fill in rather than on a blank page.
 *
 * Returns the existing session's id instead if one is already open. The unique
 * index would reject the insert anyway; catching it here means two taps on
 * "Start" land in the same workout rather than on an error page.
 */
export async function startSession(dayId: string | null): Promise<string> {
  const open = (await sql`
    SELECT id FROM sessions WHERE finished_at IS NULL`) as { id: string }[];
  if (open.length > 0) return open[0].id;

  const source = dayId ? await getProgramDay(dayId) : null;
  const sessionId = crypto.randomUUID();

  await sql`
    INSERT INTO sessions (id, day_name, program_name, program_id, day_id)
    VALUES (${sessionId}, ${source?.day.name ?? "Workout"},
            ${source?.programName ?? ""}, ${source?.programId ?? null}::uuid,
            ${dayId}::uuid)`;

  if (source) {
    const statements = [];
    for (const [i, planned] of source.day.exercises.entries()) {
      const logId = crypto.randomUUID();
      statements.push(sql`
        INSERT INTO exercise_logs
          (id, session_id, exercise_id, name, muscle_group, position,
           planned_sets, planned_reps)
        VALUES (${logId}, ${sessionId}, ${planned.exerciseId}::uuid, ${planned.name},
                ${planned.muscleGroup}, ${i}, ${planned.plannedSets},
                ${planned.plannedReps})`);
      for (let n = 1; n <= Math.max(1, planned.plannedSets); n++) {
        statements.push(sql`
          INSERT INTO set_logs (exercise_log_id, set_number, reps)
          VALUES (${logId}, ${n}, ${planned.plannedReps})`);
      }
    }
    if (statements.length > 0) await sql.transaction(statements);
  }
  return sessionId;
}

/** Adds a lift to the workout in progress, with one empty set to start. */
export async function addExerciseToSession(
  sessionId: string, exerciseId: string | null, name: string, muscleGroup: string,
): Promise<string> {
  const logId = crypto.randomUUID();
  await sql.transaction([
    sql`
      INSERT INTO exercise_logs (id, session_id, exercise_id, name, muscle_group, position)
      VALUES (${logId}, ${sessionId}, ${exerciseId}::uuid, ${name}, ${muscleGroup},
              (SELECT coalesce(max(position), -1) + 1 FROM exercise_logs
                WHERE session_id = ${sessionId}))`,
    sql`INSERT INTO set_logs (exercise_log_id, set_number) VALUES (${logId}, 1)`,
  ]);
  return logId;
}

export async function removeExerciseLog(logId: string): Promise<void> {
  await sql`DELETE FROM exercise_logs WHERE id = ${logId}`;
}

export async function saveExerciseLogNotes(logId: string, notes: string): Promise<void> {
  await sql`UPDATE exercise_logs SET notes = ${notes} WHERE id = ${logId}`;
}

export type SetPatch = {
  weight?: number; reps?: number; rir?: number | null; rpe?: number | null;
  isCompleted?: boolean; isWarmup?: boolean; notes?: string;
};

/**
 * Updates one set. Every field is optional and only the ones present are
 * written, so the weight box and the RIR dialog can save independently without
 * either clobbering the other's value.
 *
 * COALESCE against a typed NULL is how "not present" is expressed, which is why
 * `rir` and `rpe` — the two nullable columns — cannot use it: for them NULL is
 * a real value meaning "not rated". They get an explicit flag instead.
 */
export async function updateSet(setId: string, patch: SetPatch): Promise<void> {
  const setsRir = "rir" in patch;
  const setsRpe = "rpe" in patch;
  await sql`
    UPDATE set_logs
       SET weight       = coalesce(${patch.weight ?? null}::double precision, weight),
           reps         = coalesce(${patch.reps ?? null}::int, reps),
           rir          = CASE WHEN ${setsRir} THEN ${patch.rir ?? null}::int ELSE rir END,
           rpe          = CASE WHEN ${setsRpe} THEN ${patch.rpe ?? null}::double precision
                               ELSE rpe END,
           notes        = coalesce(${patch.notes ?? null}::text, notes),
           is_completed = coalesce(${patch.isCompleted ?? null}::boolean, is_completed),
           is_warmup    = coalesce(${patch.isWarmup ?? null}::boolean, is_warmup)
     WHERE id = ${setId}`;
}

/** Deletes a set and closes the gap in the numbering, so a set list never
 *  reads 1, 2, 4. */
export async function deleteSet(setId: string): Promise<void> {
  const rows = (await sql`
    DELETE FROM set_logs WHERE id = ${setId}
    RETURNING exercise_log_id, set_number`) as
    { exercise_log_id: string; set_number: number }[];
  const row = rows[0];
  if (!row) return;
  await sql`
    UPDATE set_logs SET set_number = set_number - 1
     WHERE exercise_log_id = ${row.exercise_log_id} AND set_number > ${row.set_number}`;
}

export async function saveSessionNotes(sessionId: string, notes: string): Promise<void> {
  await sql`UPDATE sessions SET notes = ${notes} WHERE id = ${sessionId}`;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
}

/**
 * Closes the workout: drops sets that were never ticked off, stamps the
 * duration from the real start time, and records any personal records the
 * session set. Returns the new records so the finish screen can show them.
 *
 * Duration comes from `started_at` rather than from a number the browser sends,
 * so a phone that slept through half the session still gets it right.
 */
export async function finishSession(sessionId: string): Promise<PersonalRecord[]> {
  await sql`DELETE FROM set_logs
             WHERE exercise_log_id IN (SELECT id FROM exercise_logs
                                        WHERE session_id = ${sessionId})
               AND NOT is_completed`;
  // Exercises left with nothing logged did not happen.
  await sql`
    DELETE FROM exercise_logs
     WHERE session_id = ${sessionId}
       AND NOT EXISTS (SELECT 1 FROM set_logs WHERE exercise_log_id = exercise_logs.id)`;

  const records = await recordPersonalRecords(sessionId);

  await sql`
    UPDATE sessions
       SET finished_at = now(),
           duration_seconds = greatest(0, extract(epoch FROM now() - started_at)::int)
     WHERE id = ${sessionId} AND finished_at IS NULL`;

  return records;
}

/* ---------------------------------------------------------------- records */

/**
 * A personal record is a set whose estimated 1RM beats every set of that lift
 * logged before this session. Estimated rather than absolute weight, so a
 * heavier single and a lighter set of eight can both be records, which is how
 * lifters actually read them.
 *
 * Only the best set per exercise is stored, so a session where three sets all
 * beat the old mark leaves one record, not three.
 */
async function recordPersonalRecords(sessionId: string): Promise<PersonalRecord[]> {
  const session = await getSession(sessionId);
  if (!session) return [];

  const created: PersonalRecord[] = [];
  for (const log of session.exercises) {
    const working = log.sets.filter((s) => s.isCompleted && !s.isWarmup && s.reps > 0 && s.weight > 0);
    if (working.length === 0) continue;

    const best = working.reduce((a, b) =>
      estimated1RM(b.weight, b.reps) > estimated1RM(a.weight, a.reps) ? b : a);

    // Earlier sessions only. Comparing against this session's own rows would
    // make a record beat itself the second time finish is tapped.
    const prior = (await sql`
      SELECT weight, reps FROM personal_records
       WHERE lower(exercise_name) = lower(${log.name})
         AND (session_id IS DISTINCT FROM ${sessionId}::uuid)`) as
      { weight: number; reps: number }[];
    const priorBest = prior.reduce((max, r) => Math.max(max, estimated1RM(r.weight, r.reps)), 0);

    if (estimated1RM(best.weight, best.reps) <= priorBest) continue;

    const rows = (await sql`
      INSERT INTO personal_records (exercise_name, exercise_id, weight, reps, session_id)
      VALUES (${log.name}, ${log.exerciseId}::uuid, ${best.weight}, ${best.reps}, ${sessionId})
      RETURNING id, exercise_name, weight, reps, achieved_at::text AS achieved_at, session_id`) as {
      id: string; exercise_name: string; weight: number; reps: number;
      achieved_at: string; session_id: string | null;
    }[];
    const r = rows[0];
    created.push({
      id: r.id, exerciseName: r.exercise_name, weight: r.weight, reps: r.reps,
      achievedAt: r.achieved_at, sessionId: r.session_id,
    });
  }
  return created;
}

/** The current best per lift — one row each, most recent first. */
export async function getPersonalRecords(): Promise<PersonalRecord[]> {
  const rows = (await sql`
    SELECT DISTINCT ON (lower(exercise_name))
           id, exercise_name, weight, reps, achieved_at::text AS achieved_at, session_id
      FROM personal_records
     ORDER BY lower(exercise_name),
              (CASE WHEN reps <= 1 THEN weight ELSE weight * (1 + reps / 30.0) END) DESC,
              achieved_at DESC`) as {
    id: string; exercise_name: string; weight: number; reps: number;
    achieved_at: string; session_id: string | null;
  }[];
  return rows
    .map((r) => ({
      id: r.id, exerciseName: r.exercise_name, weight: r.weight, reps: r.reps,
      achievedAt: r.achieved_at, sessionId: r.session_id,
    }))
    .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt));
}

/* ------------------------------------------------------------- bodyweight */

export async function getBodyweight(): Promise<BodyweightEntry[]> {
  const rows = (await sql`
    SELECT id, date::text AS date, weight FROM bodyweight_entries
     ORDER BY date DESC LIMIT 400`) as BodyweightEntry[];
  return rows;
}

/** One entry per day — logging twice replaces rather than stacks. */
export async function addBodyweight(weight: number, date: string): Promise<void> {
  await sql.transaction([
    sql`DELETE FROM bodyweight_entries WHERE date = ${date}`,
    sql`INSERT INTO bodyweight_entries (date, weight) VALUES (${date}, ${weight})`,
  ]);
}

export async function deleteBodyweight(id: string): Promise<void> {
  await sql`DELETE FROM bodyweight_entries WHERE id = ${id}`;
}

/* ------------------------------------------------------------------ stats */

/**
 * Aggregates run in SQL rather than by loading every set into Node, so the
 * stats page costs the same on session one and session five hundred.
 *
 * `effectiveRepsSQL` is interpolated into the query text, not passed as a
 * parameter — the neon driver has no fragment type, so a tagged template would
 * send it as a string value instead of as SQL. It is a module constant built
 * from a number, never from anything a request carries.
 */

export type WeeklyTotals = {
  weekStart: string;
  volume: number;
  workingSets: number;
  effectiveReps: number;
  ratedSets: number;
};

export async function getWeeklyTotals(weeks = 12): Promise<WeeklyTotals[]> {
  const rows = (await sql.query(
    `SELECT to_char(date_trunc('week', s.started_at), 'YYYY-MM-DD') AS week_start,
            coalesce(sum(sl.weight * sl.reps) FILTER (WHERE ${countedSetSQL}), 0) AS volume,
            count(*) FILTER (WHERE ${countedSetSQL}) AS working_sets,
            coalesce(sum(${effectiveRepsSQL}), 0) AS effective_reps,
            count(*) FILTER (WHERE ${countedSetSQL} AND sl.rir IS NOT NULL) AS rated_sets
       FROM sessions s
       JOIN exercise_logs el ON el.session_id = s.id
       JOIN set_logs sl ON sl.exercise_log_id = el.id
      WHERE s.finished_at IS NOT NULL
        AND s.started_at >= date_trunc('week', now()) - ($1::int - 1) * interval '1 week'
        AND sl.is_completed
      GROUP BY 1 ORDER BY 1`,
    [weeks],
  )) as {
    week_start: string; volume: string; working_sets: string;
    effective_reps: string; rated_sets: string;
  }[];
  return rows.map((r) => ({
    weekStart: r.week_start,
    volume: Number(r.volume),
    workingSets: Number(r.working_sets),
    effectiveReps: Number(r.effective_reps),
    ratedSets: Number(r.rated_sets),
  }));
}

export type MuscleTotals = {
  muscleGroup: string;
  workingSets: number;
  /** Working sets rated at or under HARD_SET_MAX_RIR — the paper's "hard set". */
  hardSets: number;
  effectiveReps: number;
  ratedSets: number;
  volume: number;
  /** Distinct finished sessions in which this muscle was trained. */
  sessions: number;
};

export async function getMuscleTotals(days = 7): Promise<MuscleTotals[]> {
  const rows = (await sql.query(
    `SELECT el.muscle_group,
            count(*) FILTER (WHERE ${countedSetSQL}) AS working_sets,
            count(*) FILTER (WHERE ${countedSetSQL} AND sl.rir <= $2) AS hard_sets,
            coalesce(sum(${effectiveRepsSQL}), 0) AS effective_reps,
            count(*) FILTER (WHERE ${countedSetSQL} AND sl.rir IS NOT NULL) AS rated_sets,
            coalesce(sum(sl.weight * sl.reps) FILTER (WHERE ${countedSetSQL}), 0) AS volume,
            count(DISTINCT s.id) FILTER (WHERE ${countedSetSQL}) AS sessions
       FROM sessions s
       JOIN exercise_logs el ON el.session_id = s.id
       JOIN set_logs sl ON sl.exercise_log_id = el.id
      WHERE s.finished_at IS NOT NULL
        AND s.started_at >= now() - ($1::int * interval '1 day')
        AND sl.is_completed
      GROUP BY 1 ORDER BY effective_reps DESC, working_sets DESC`,
    [days, HARD_SET_MAX_RIR],
  )) as {
    muscle_group: string; working_sets: string; hard_sets: string; effective_reps: string;
    rated_sets: string; volume: string; sessions: string;
  }[];
  return rows.map((r) => ({
    muscleGroup: r.muscle_group,
    workingSets: Number(r.working_sets),
    hardSets: Number(r.hard_sets),
    effectiveReps: Number(r.effective_reps),
    ratedSets: Number(r.rated_sets),
    volume: Number(r.volume),
    sessions: Number(r.sessions),
  }));
}

export type ExerciseTotals = {
  name: string;
  workingSets: number;
  effectiveReps: number;
  ratedSets: number;
  best1RM: number;
};

export async function getExerciseTotals(days = 30): Promise<ExerciseTotals[]> {
  const rows = (await sql.query(
    `SELECT el.name,
            count(*) FILTER (WHERE ${countedSetSQL}) AS working_sets,
            coalesce(sum(${effectiveRepsSQL}), 0) AS effective_reps,
            count(*) FILTER (WHERE ${countedSetSQL} AND sl.rir IS NOT NULL) AS rated_sets,
            coalesce(max(CASE WHEN NOT ${countedSetSQL} THEN NULL
                              WHEN sl.reps <= 1 THEN sl.weight
                              ELSE sl.weight * (1 + sl.reps / 30.0) END), 0) AS best_1rm
       FROM sessions s
       JOIN exercise_logs el ON el.session_id = s.id
       JOIN set_logs sl ON sl.exercise_log_id = el.id
      WHERE s.finished_at IS NOT NULL
        AND s.started_at >= now() - ($1::int * interval '1 day')
        AND sl.is_completed
      GROUP BY 1 ORDER BY effective_reps DESC, working_sets DESC LIMIT 40`,
    [days],
  )) as {
    name: string; working_sets: string; effective_reps: string;
    rated_sets: string; best_1rm: string;
  }[];
  return rows.map((r) => ({
    name: r.name,
    workingSets: Number(r.working_sets),
    effectiveReps: Number(r.effective_reps),
    ratedSets: Number(r.rated_sets),
    best1RM: Number(r.best_1rm),
  }));
}

export type Headline = {
  sessions: number;
  volume: number;
  workingSets: number;
  effectiveReps: number;
  ratedSets: number;
};

export async function getHeadline(days: number): Promise<Headline> {
  const rows = (await sql.query(
    `SELECT count(DISTINCT s.id) AS sessions,
            coalesce(sum(sl.weight * sl.reps) FILTER (WHERE ${countedSetSQL}), 0) AS volume,
            count(sl.id) FILTER (WHERE ${countedSetSQL}) AS working_sets,
            coalesce(sum(${effectiveRepsSQL}), 0) AS effective_reps,
            count(sl.id) FILTER (WHERE ${countedSetSQL} AND sl.rir IS NOT NULL) AS rated_sets
       FROM sessions s
       LEFT JOIN exercise_logs el ON el.session_id = s.id
       LEFT JOIN set_logs sl ON sl.exercise_log_id = el.id AND sl.is_completed
      WHERE s.finished_at IS NOT NULL
        AND s.started_at >= now() - ($1::int * interval '1 day')`,
    [days],
  )) as {
    sessions: string; volume: string; working_sets: string;
    effective_reps: string; rated_sets: string;
  }[];
  const r = rows[0];
  return {
    sessions: Number(r?.sessions ?? 0),
    volume: Number(r?.volume ?? 0),
    workingSets: Number(r?.working_sets ?? 0),
    effectiveReps: Number(r?.effective_reps ?? 0),
    ratedSets: Number(r?.rated_sets ?? 0),
  };
}

/**
 * The previous session for each lift, with every set it contained — the "last
 * time" column on the gym screen.
 *
 * `DISTINCT ON` picks the most recent finished session that has a completed set
 * of that lift; the join back then collects **every** log of that name in that
 * session, so a freestyle day that added "Cable Row" twice reads as one list
 * rather than silently dropping half of it.
 */
export type LastSessionSet = {
  setNumber: number; weight: number; reps: number; rir: number | null; isWarmup: boolean;
};
export type LastSession = { date: string; sets: LastSessionSet[] };

export async function getLastSessionSets(names: string[]): Promise<Map<string, LastSession>> {
  if (names.length === 0) return new Map();
  const rows = (await sql`
    WITH latest AS (
      SELECT DISTINCT ON (lower(el.name))
             lower(el.name) AS key, s.id AS session_id, s.started_at
        FROM sessions s
        JOIN exercise_logs el ON el.session_id = s.id
        JOIN set_logs sl ON sl.exercise_log_id = el.id AND sl.is_completed
       WHERE s.finished_at IS NOT NULL
         AND lower(el.name) = ANY(${names.map((n) => n.toLowerCase())}::text[])
       ORDER BY lower(el.name), s.started_at DESC
    )
    SELECT l.key, l.started_at::text AS date, sl.set_number, sl.weight, sl.reps,
           sl.rir, sl.is_warmup
      FROM latest l
      JOIN exercise_logs el ON el.session_id = l.session_id AND lower(el.name) = l.key
      JOIN set_logs sl ON sl.exercise_log_id = el.id AND sl.is_completed
     ORDER BY l.key, el.position, sl.set_number`) as {
    key: string; date: string; set_number: number; weight: number;
    reps: number; rir: number | null; is_warmup: boolean;
  }[];

  const out = new Map<string, LastSession>();
  for (const r of rows) {
    const entry = out.get(r.key) ?? { date: r.date, sets: [] };
    entry.sets.push({
      setNumber: entry.sets.length + 1,
      weight: r.weight, reps: r.reps, rir: r.rir, isWarmup: r.is_warmup,
    });
    out.set(r.key, entry);
  }
  return out;
}

/** Inserts an already-performed set. The gym screen adds sets through the set
 *  sheet, which knows the numbers before the row exists, so there is no empty
 *  row in between to patch. */
export async function insertCompletedSet(
  logId: string,
  values: { weight: number; reps: number; rir: number | null; isWarmup: boolean },
): Promise<void> {
  await sql`
    INSERT INTO set_logs (exercise_log_id, set_number, weight, reps, rir, is_completed, is_warmup)
    SELECT ${logId}, coalesce(max(set_number), 0) + 1, ${values.weight}, ${values.reps},
           ${values.rir}::int, true, ${values.isWarmup}
      FROM set_logs WHERE exercise_log_id = ${logId}`;
}
