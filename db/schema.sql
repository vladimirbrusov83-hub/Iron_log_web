-- IronLog schema. Applied by `npm run db:push`. Idempotent — safe to re-run.
--
-- One person uses this database, so there is no users table and no ownership
-- column anywhere. The gate is a single passcode in middleware; see lib/auth.ts.
-- `settings` is a one-row table for that reason: id is fixed at 1.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS settings (
  id                   int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  weight_unit          text NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg','lb')),
  default_rest_seconds int  NOT NULL DEFAULT 90,
  track_rir            boolean NOT NULL DEFAULT true
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS bodyweight_entries (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date   date NOT NULL DEFAULT current_date,
  weight double precision NOT NULL
);

CREATE INDEX IF NOT EXISTS bodyweight_date_idx ON bodyweight_entries (date DESC);

-- The exercise library. `is_preset` marks the 45 seeded rows so the library
-- screen can separate them from ones typed in later; it does not protect them.
CREATE TABLE IF NOT EXISTS exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  muscle_group text NOT NULL,
  is_compound  boolean NOT NULL DEFAULT false,
  notes        text NOT NULL DEFAULT '',
  is_preset    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive, so "bench press" cannot be added next to "Bench Press".
-- This is also what makes the exercise seed in db-push.mjs idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS exercises_name_key ON exercises (lower(name));

/* ------------------------------------------------------------- programs */

CREATE TABLE IF NOT EXISTS programs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_pinned   boolean NOT NULL DEFAULT false,
  is_preset   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS programs_preset_name_key
  ON programs (lower(name)) WHERE is_preset;

CREATE TABLE IF NOT EXISTS program_days (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs (id) ON DELETE CASCADE,
  name       text NOT NULL,
  position   int  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS program_days_program_idx ON program_days (program_id, position);

-- Which day this one was copied from, so the program editor can cap copies at
-- MAX_DAY_COPIES per original. A copy of a copy points at the original.
ALTER TABLE program_days
  ADD COLUMN IF NOT EXISTS copied_from uuid REFERENCES program_days (id) ON DELETE SET NULL;

-- exercise_id is SET NULL rather than CASCADE: deleting a lift from the library
-- should not silently delete it out of every program that planned it. The row
-- keeps its own name so the day still reads correctly afterwards.
CREATE TABLE IF NOT EXISTS planned_exercises (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id        uuid NOT NULL REFERENCES program_days (id) ON DELETE CASCADE,
  exercise_id   uuid REFERENCES exercises (id) ON DELETE SET NULL,
  name          text NOT NULL,
  muscle_group  text NOT NULL DEFAULT 'Other',
  position      int  NOT NULL DEFAULT 0,
  planned_sets  int  NOT NULL DEFAULT 3,
  planned_reps  int  NOT NULL DEFAULT 10
);

CREATE INDEX IF NOT EXISTS planned_exercises_day_idx ON planned_exercises (day_id, position);

/* ------------------------------------------------------------- sessions */

-- A session snapshots the program and day names it was started from. Rename a
-- program later and history still reads the way it happened.
CREATE TABLE IF NOT EXISTS sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  day_name         text NOT NULL DEFAULT 'Workout',
  program_name     text NOT NULL DEFAULT '',
  program_id       uuid REFERENCES programs (id) ON DELETE SET NULL,
  day_id           uuid REFERENCES program_days (id) ON DELETE SET NULL,
  duration_seconds int  NOT NULL DEFAULT 0,
  notes            text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS sessions_started_idx ON sessions (started_at DESC);

-- At most one unfinished session. Starting a workout while another is open is
-- a mistake, not a feature, and the partial index says so in the database
-- rather than in whichever screen happens to check.
CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active_key
  ON sessions ((finished_at IS NULL)) WHERE finished_at IS NULL;

CREATE TABLE IF NOT EXISTS exercise_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  exercise_id   uuid REFERENCES exercises (id) ON DELETE SET NULL,
  name          text NOT NULL,
  muscle_group  text NOT NULL DEFAULT 'Other',
  position      int  NOT NULL DEFAULT 0,
  notes         text NOT NULL DEFAULT '',
  planned_sets  int  NOT NULL DEFAULT 0,
  planned_reps  int  NOT NULL DEFAULT 0,
  is_done       boolean NOT NULL DEFAULT false
);

-- "Done" on the exercise screen: the lift is finished for today and its row
-- on the session list turns green. Added after the table existed, hence ALTER.
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS is_done boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS exercise_logs_session_idx ON exercise_logs (session_id, position);
CREATE INDEX IF NOT EXISTS exercise_logs_name_idx ON exercise_logs (lower(name));

-- Real columns, not a jsonb blob: the stats page aggregates reps and rir in
-- SQL, and effective reps are derived from them on every row.
--
-- `rir` is NULL for "not rated", never -1 as the iOS app stored it. Effective
-- reps of a set with no rating are unknown, and NULL is the only value that
-- keeps them out of a SUM instead of counting as zero or as six.
--
-- The range is 0-5 where 5 means "5 or more left" — the easy-set case. It has
-- to be reachable or no set can ever score zero effective reps.
CREATE TABLE IF NOT EXISTS set_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_log_id uuid NOT NULL REFERENCES exercise_logs (id) ON DELETE CASCADE,
  set_number      int  NOT NULL,
  weight          double precision NOT NULL DEFAULT 0,
  reps            int  NOT NULL DEFAULT 0,
  rir             int  CHECK (rir IS NULL OR (rir >= 0 AND rir <= 5)),
  rpe             double precision CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  notes           text NOT NULL DEFAULT '',
  is_completed    boolean NOT NULL DEFAULT false,
  is_warmup       boolean NOT NULL DEFAULT false
);

-- Rest-pause: the total reps of the mini-sets after the activation set. `reps`
-- and `rir` describe the activation set; every mini-set rep scores in full.
-- NOT NULL DEFAULT 0 on purpose — effectiveRepsSQL adds it straight on, and a
-- NULL here would void the whole sum. Added after the table existed, hence ALTER.
ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS rest_pause_reps int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS set_logs_log_idx ON set_logs (exercise_log_id, set_number);

/* ---------------------------------------------------------------- records */

CREATE TABLE IF NOT EXISTS personal_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_name text NOT NULL,
  exercise_id   uuid REFERENCES exercises (id) ON DELETE SET NULL,
  weight        double precision NOT NULL,
  reps          int NOT NULL,
  achieved_at   timestamptz NOT NULL DEFAULT now(),
  session_id    uuid REFERENCES sessions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS personal_records_name_idx
  ON personal_records (lower(exercise_name), achieved_at DESC);
