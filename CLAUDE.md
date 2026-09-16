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

## The gym screen

Modelled on the iOS app Vladimir showed in September 2026: each lift is **two columns** —
last session's complete set list on the left, today's on the right — and sets are entered
through a **sheet**, never inline. There are no number boxes in the card any more.

- `getLastSessionSets` supplies the left column: the most recent *finished* session per
  lift, every completed set of it. It merges duplicate logs of the same name in that
  session rather than dropping one, which `DISTINCT ON` alone would do.
- `logSet` is the only way a set is written. It sends weight, reps, RIR and `isCompleted`
  in **one** call, so nothing lands half-saved. `saveSet`/`appendSet`/`db.addSet` were
  deleted when the inline grid went; do not bring back a two-write path.
- A program day still lays its planned sets out as empty rows. The sheet **fills the next
  empty row** (`fillId`) before appending, so the plan is consumed instead of sitting
  blank beside what happened. `finishSession` still sweeps any left over.
- The sheet prefills from **this session's previous set**, never from last week. Last
  week's numbers are on the left to be read. That distinction is the no-suggestions line.
- Saving a new working set starts the rest timer; editing an old one does not.

## The home screen

The program card is the point of the page and sits in the middle of the glass. It is a
**swipeable carousel** (`components/program-carousel.tsx`) over `getProgramsByRecentUse`,
which orders by the last session started from each program — so it opens on the one being
run, with no pinned-program logic involved. Two details that will bite if removed: the
swipe is native `snap-x` scrolling, not a gesture handler, and the track's height is set
from the **active slide** because flex children otherwise all stretch to the tallest
program, padding a two-day card out to a six-day one.

`Start` on the card goes to **`/start`**, the week: every day of that program in full with
the last date it was trained, each with its own start button, and freestyle at the bottom.
Tapping a day on the home card still starts it directly and skips that screen. `/start`
redirects into the open session if there is one, because there is only ever one.

Hard sets per muscle and Recent workouts are native `<details>` drawers, closed by
default, each with the headline on its summary row so the page reads without opening them.

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
