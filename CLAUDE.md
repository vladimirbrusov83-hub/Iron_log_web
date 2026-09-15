# IronLog (web) — working notes

Next.js 15 App Router, TypeScript, Tailwind 4, Neon Postgres (`@neondatabase/serverless`,
raw SQL, no ORM). One passcode, no accounts. Dark only, phone-first.

Rebuilt September 2026 from the iOS app in `~/Documents/IronLog/IronLog/` at Vladimir's
request: "rebuild it as a website with Neon database as backend, no coach brain at all,
add effective reps based on RIR, rest stays the same."

## Scope — read before adding anything

**No coaching engine.** CoachBrain, CoachBrainGate, CoachBrainMapper, CoachView and
ProgressionEngine were all dropped on purpose — that includes warmup ladders, suggested
next weights, plateau detection and deload warnings. This app records what happened and
counts it. Nothing suggests a load. Same line as
[[clientprogram_project]], and it is the one to defend.

Effective reps are the exception that proves it: they describe a set that is already
logged. They never point forward.

## Effective reps

`lib/effective-reps.ts` is the only definition, in two forms — a TS function and
`effectiveRepsSQL`. Change one, change the other.

```
min(reps, 5 − rir), floored at 0
```

The three null cases are load-bearing: no RIR, warmup, and not-ticked all return null
and stay out of sums. **Do not "fix" this to zero.** An unrated set is unknown, and every
screen showing a total also shows the scored/working count so a low number cannot be
misread. RIR runs 0–5 where 5 means "5 or more" — Vladimir chose that range so a
genuinely easy set can score zero, which is unreachable on the iOS app's 0–4.

Never store it in a column. It is derived on read.

## Reference bands (lib/targets.ts)

The only "targets" in the app, taken from Vladimir's own paper *Hypertrophy Training —
Principles That Work* (2026, rev3, `~/Documents/Hyper_gulde/`): 5 hard sets a week per
muscle is the floor, 10–16 the productive range; 20–40 effective reps per muscle per
session; 2 sessions a week. A "hard set" is a working set at RIR ≤ 3. They colour bars on
Today, Stats, History and the program editor. They never turn into a suggested load —
that stays the line. `getMuscleTotals` returns `hardSets` and `sessions` for them.

## Design

Barlow Condensed (display, all big numbers) + Barlow (body) via `next/font`. Tokens in
`app/globals.css`; `.display`, `.eyebrow`, `.tnum`, `.rise` are the utility classes.
Band colours: green in range, amber under/over, red below floor. The gym screen hides
the bottom nav and floats the rest timer instead; it auto-starts when a set is logged.

Picking a RIR chip logs the set: `rate()` sends `rir`, `isCompleted` and the typed
weight/reps in **one** `saveSet` call, so effective reps appear on the rating rather than
waiting for a second tap on ✓. Two patches here would race two revalidations on one row.
Clearing the rating with ✕ leaves the set logged — ✓ is what unticks it.

## Setup

```
DATABASE_URL=      # Neon pooled
APP_PASSCODE=      # typed once at /login
```

`npm run db:push` applies `db/schema.sql` and seeds 45 exercises + 3 preset programs.
Idempotent, and it skips any preset program that already exists rather than overwriting
edits. **Run it before pushing code that reads a new column** — one database serves local
and production, and Vercel never runs it.

## Things that will bite

- `sql.query(text, params)` is used for the stats aggregates because `effectiveRepsSQL`
  is a *fragment* — the neon driver has no fragment type, so a tagged template would send
  it as a string value. Only module constants are ever interpolated that way.
- `updateSet` takes a partial patch. `rir`/`rpe` cannot use COALESCE for "absent", because
  NULL is a real value for them; they use an explicit `"rir" in patch` flag. Collapsing
  that would wipe a rating every time the weight box saved.
- The rest timer derives remaining time from a stored end timestamp, never by
  decrementing. iOS Safari throttles `setInterval` on a locked phone. There are no
  haptics on iOS Safari either — `navigator.vibrate` is a no-op there and the Web Audio
  beep carries the alert alone. It only works because the AudioContext is created inside
  the tap that starts the timer.
- `saveProgram` deletes and reinserts a program's days. Safe because sessions reference
  `day_id` with ON DELETE SET NULL and keep their own `day_name` snapshot.
- Session duration is computed from `started_at` in SQL, not from a number the browser
  sends, so a phone that slept mid-session still gets it right.

## Ported from iOS, unchanged in spirit

Workout logging, programs with drag-free reorder (↑↓ buttons), history, PRs by Epley
e1RM, per-muscle and per-lift stats, bodyweight, rest timer, the 45-exercise library,
kg/lb. Dropped along with the coach: push notifications (web push needs a service worker
and Vladimir did not ask for one) and `.ironlog` export/import.

The iOS app is still at `~/Documents/IronLog/IronLog/` with uncommitted work in it.
Vladimir asked for it to be left alone — do not commit or push that repo.
