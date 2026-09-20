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
min(reps, 5 − rir), floored at 0 — and nothing at all above 4 RIR
```

The four null cases are load-bearing: no RIR, warmup, not-ticked, and **anything above
`MAX_COUNTED_RIR` (4)**. All return null and stay out of every sum. **Do not "fix" this to
zero.**

A set over 4 RIR counts for nothing anywhere — no score, not a working set, no volume, no
e1RM. That rule replaced the warm-up checkbox in September 2026 at Vladimir's request: an
easy set says so through its rating instead of through a tick box. The `is_warmup` column
stays and is still honoured for rows that have it, but nothing writes it any more.

There are therefore **two** rules kept in two languages, and `npm run check` asserts both:

| TypeScript | SQL | Decides |
|---|---|---|
| `effectiveReps()` | `effectiveRepsSQL` | what one set scores |
| `isCountedSet()` | `countedSetSQL` | whether it counts at all |

An unrated set is unknown, not easy, and every screen showing a total also shows the
scored/working count so a low number cannot be misread. RIR runs 0–5 where 5 means "5 or
more", which is the value that drops a set out entirely.

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

## The gym is two screens

Vladimir asked for the split in September 2026: "when I start a day it should be a list of
exercises, and to track sets and see previous workouts you click on the exercise — so
tracking sets is a new screen." Five lifts of two-column cards down one page left too
little of either side readable.

**`/log/[id]` — the session.** The sticky scoreboard (effective reps, the
`scored/working` rated line, per-muscle chips) over **one row per lift**: position, name,
muscle, `done/planned` sets, the last set done, its effective reps, a chevron. The whole
row is the link — nothing on it is separately tappable. Then Add exercise, session notes,
Finish and Discard. It no longer loads `getLastSessionSets`; that belongs to one lift.

**`/log/[id]/[logId]` — one lift.** The standing note, then last session's complete set
list beside today's, the `+ Add set` button, and the ⋯ drawer with this session's note and
Remove exercise. It is a real page and can be landed on directly, so it repeats the
`finishedAt → /history/[id]` guard and `notFound()`s on a `logId` that is not in the
session.

### Two notes, and they are not the same note

Vladimir asked in September 2026 for "a small window for note, and I want to see that note
next time when I will be doing this exercise", and chose the standing kind over a
per-session one carried forward.

| Where | Column | Lives with |
|---|---|---|
| The card above the sets | `exercises.notes` | **the lift** — every session, unchanged, until edited |
| The ⋯ drawer | `exercise_logs.notes` | **that session**, and its history entry |

- `getExerciseNote(name)` resolves the library row **by name**, not by `exercise_id`:
  that column is `ON DELETE SET NULL` and a one-off log never had one. Same reason
  `getExerciseUsage` and `getLastSessionSets` match on the name. A one-off therefore picks
  its note up by itself once the lift is added to the library.
- No library row means no box at all, rather than one that quietly loses what is typed.
  The ⋯ drawer's session note still covers that lift.
- `saveExerciseNote` writes **notes only**. `updateExercise` also sets the name, muscle
  group and compound flag, so calling it from the gym would push three stale values over a
  library edit made in between.
- `noteLibraryExercise` revalidates **`/exercises` as well** — it is the same field the
  exercise base edits, and that page would otherwise serve a stale note.
- The textarea is keyed on the note's id, so walking to the next lift does not leave the
  previous one's text in an uncontrolled field.

- `getLastSessionSets` supplies the left column: the most recent *finished* session per
  lift, every completed set of it. It merges duplicate logs of the same name in that
  session rather than dropping one, which `DISTINCT ON` alone would do. The exercise
  screen passes it one name.
- Sets are still entered through a **sheet**, never inline. A full screen invites putting
  weight/reps boxes back into the card; that was decided against and the reasons below
  (keyboard, focus, one-write saves) have not changed.
- `logSet` is the only way a set is written. It sends weight, reps, RIR and `isCompleted`
  in **one** call, so nothing lands half-saved. `saveSet`/`appendSet`/`db.addSet` were
  deleted when the inline grid went; do not bring back a two-write path.
- A program day still lays its planned sets out as empty rows. The sheet **fills the next
  empty row** (`fillId`) before appending, so the plan is consumed instead of sitting
  blank beside what happened. `finishSession` still sweeps any left over.
- The session actions revalidate with `revalidatePath(path, "layout")`. Plain
  `revalidatePath("/log/<id>")` does **not** cover `/log/<id>/<logId>`, and a set logged
  on the exercise screen would change nothing on it — which reads as a broken app.
- `dropExercise` from the exercise screen `router.push`es back to the session first. It is
  deleting that page's own subject.
- Logging a set leaves you on the lift. There is no jump to the next exercise, by choice.
- The sheet prefills from **this session's previous set**, never from last week. Last
  week's numbers are on the left to be read. That distinction is the no-suggestions line.
- Saving a new working set starts the rest timer; editing an old one does not.
- The rating chips call `preventDefault` on mousedown so focus stays in the number field.
  Without it, every tap on a rating closed the keyboard and the sheet dropped back down.
- The sheet sits above the on-screen keyboard. `useKeyboardInset` reads
  `window.visualViewport` — iOS Safari does **not** shrink the layout viewport for the
  keyboard, so a `fixed` sheet pinned to the bottom lands underneath it. The sheet body
  scrolls and the Log/Save buttons are pinned outside it, so they stay reachable with
  only a few hundred pixels of screen left.

## The program editor is per-day

`/programs/[id]` is the program: name, the days in order, and what the week adds up to.
`/programs/[id]/days/[dayId]` is one day, and it is the only place lifts are added, ordered
or removed. **Save day** is explicit and the button doubles as the dirty flag — `No
changes`, `Save day`, `Saved`.

- `saveProgramDay` replaces one day's name and planned rows and leaves the rest of the
  program alone. This is better than the old whole-program `saveProgram`, which deleted and
  reinserted **every** day and so detached every past session from its `day_id`.
  `saveProgram` survives only because `duplicateProgram` uses it.
- A row is name + muscle-group chip; sets × reps live behind the `3 × 10` summary line.
  Vladimir asked for that specifically — the day list is scanned for which lifts and in
  what order, not for rep schemes.

### Adding lifts

`+ Add lifts` opens `components/exercise-picker.tsx`: muscle-group chips, name search, a
tick per row and an `Add N lifts` footer, so a day is filled in one visit. `+ New exercise`
is always in that list and opens a **dialog with its own name field** (seeded from the
search box and the active group chip when there is one). `createExercise` writes it, and it
comes back **already selected** and in the list, so it is never searched for twice. The
editor holds `library` in state for exactly that reason; the server prop only seeds it.

Near-duplicates are refused before saving: names are compared with all non-alphanumerics
stripped, so `bench-press` finds `Bench Press` and offers to use it instead. The unique
index only catches the case difference.

### Dragging

`useDragReorder` in `components/drag-list.tsx`, on pointer events because HTML5
drag-and-drop does not exist on touch. The handle captures the pointer and sets
`touch-action: none`; the list reorders live and `onSettle` fires once at the end, which is
where the save goes. The handle is a **44px column of its own**, ruled off from the text,
and the drag turns selection off on `document.body` for its duration — otherwise a drag
starting near the lift name selected it, magnifier and copy bubble included. `select-none`
on the handle alone does not do it, because the pointer leaves the handle the moment the
drag starts.

### Overlays must not be trapped

The root layout wraps pages in a plain `relative` div with **no z-index**. It used to be
`z-10`, which made a stacking context and pinned every `z-50` picker underneath the `z-40`
nav — the Add button was unclickable. The gym screen never showed it because it hides the
nav. Do not put a z-index back on that wrapper.

## The exercise base

`/exercises`, reached from **More**, which is a hub of places (Exercise library, Programs)
above the preferences rather than two buttons under them. Every row carries how many
programs plan it and how many sessions contain it — `getExerciseUsage`, matched on the
name because that is what a one-off log keeps — and **Unused** is a filter chip of its own.
That is the point of the page: finding the typo saved in a hurry from a picker and removing
it. Deleting is a two-step confirm that says what survives, because `exercise_id` is
`ON DELETE SET NULL` everywhere and history and programs keep the name.

The editor's create dialog also refuses near-duplicates: names are compared with all
non-alphanumerics stripped, so `bench-press` finds `Bench Press` and offers to use it
instead. The unique index only catches the case difference.

## The home screen

The program card is the point of the page and sits in the middle of the glass. It is a
**swipeable carousel** (`components/program-carousel.tsx`) over `getProgramsByRecentUse`,
which orders by the last session started from each program — so it opens on the one being
run, with no pinned-program logic involved. Two details that will bite if removed: the
swipe is native `snap-x` scrolling, not a gesture handler, and the card is a **fixed
height** (`h-80`) whatever the program, so nothing below it moves on a swipe. A program
with more days than fit scrolls its day list inside the card.

`Start` on the card goes to **`/start`**, the week: one compact row per day — name, lift
count, last trained, lift names — and freestyle at the bottom. No sets or reps there; it
is a list you scan to pick from, and the whole row is the start button.
Tapping a day on the home card still starts it directly and skips that screen. `/start`
redirects into the open session if there is one, because there is only ever one.

Hard sets per muscle and Recent workouts are native `<details>` drawers, closed by
default, each with the headline on its summary row so the page reads without opening them.

## Testing without touching real training data

One database serves local and production, so a Playwright run that starts a workout lands
in Vladimir's history — and he has been mid-session while this repo was being worked on.
Create a second database in the same Neon project, point a scratch env file at it, run
`db:push`, and drop it afterwards. Check for an open session before touching anything.

Kill test servers by port (`lsof -ti:3311 | xargs kill -9`), not by `pkill -f "next start"`:
a stale server left listening serves a deleted build and every asset 400s, which looks
exactly like an app bug and is not one.

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
  and `countedSetSQL` are *fragments* — the neon driver has no fragment type, so a tagged
  template would send them as string values. Both use bare column names, which resolve to
  `set_logs` because it is the only joined table with them. Only module constants are ever
  interpolated that way.
- `updateSet` takes a partial patch. `rir`/`rpe` cannot use COALESCE for "absent", because
  NULL is a real value for them; they use an explicit `"rir" in patch` flag. Collapsing
  that would wipe a rating on any partial save.
- The rest timer derives remaining time from a stored end timestamp, never by
  decrementing. iOS Safari throttles `setInterval` on a locked phone. There are no
  haptics on iOS Safari either — `navigator.vibrate` is a no-op there and the Web Audio
  beep carries the alert alone. It only works because the AudioContext is created inside
  the tap that starts the timer.
- That end timestamp is mirrored into `localStorage` under `ironlog.rest`, and the gym
  screens both mount a `RestTimer` that picks it up. React state alone lost the rest the
  moment you walked from a lift back to the session list — which is exactly when you
  look. It is read in an effect, never during render, so the server and the first client
  paint agree; an already-expired rest is dropped rather than restored as "Go".
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
