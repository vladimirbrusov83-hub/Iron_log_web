# IronLog

A strength training log for the web. You log weight, reps and RIR in the gym; it counts
**effective reps** from what you logged and shows you where they went, measured against
the volume and effort ranges from *Hypertrophy Training — Principles That Work*.

Rebuilt from an iOS app of the same name. Two deliberate differences from that version:

- **No coaching engine.** No suggested loads, no warmup ladders, no plateau detection, no
  deload warnings. This app records what you did and counts it. It never tells you what to
  do next.
- **Effective reps.** The reason the rebuild exists. See below.

Built with Next.js 15 (App Router), TypeScript, Tailwind 4 and Neon Postgres. Raw SQL, no
ORM. No third-party services beyond the database.

---

## Contents

- [Effective reps](#effective-reps)
- [Reference bands](#reference-bands)
- [Screens](#screens)
- [The gym: two screens](#the-gym-two-screens)
- [The program editor](#the-program-editor)
- [The exercise base](#the-exercise-base)
- [Setup](#setup)
- [Access and the passcode](#access-and-the-passcode)
- [Project layout](#project-layout)
- [Data model](#data-model)
- [Design decisions worth knowing](#design-decisions-worth-knowing)
- [Scripts](#scripts)
- [Deploying](#deploying)

---

## Effective reps

Not every rep in a set does the same work. The reps taken close to failure are the ones
that recruit high-threshold motor units; the ones a long way from failure move the bar and
little else. So a set is scored by how close it finished to failure — which is exactly what
RIR (Reps In Reserve) already records.

```
effective reps = min(reps performed, 5 − RIR), never below zero
                 … and nothing at all above 4 RIR
```

| Set logged | Score | Why |
|---|---|---|
| 10 reps @ 0 RIR | **5** | Taken to failure — the last 5 reps counted |
| 10 reps @ 1 RIR | **4** | |
| 10 reps @ 2 RIR | **3** | |
| 10 reps @ 4 RIR | **1** | The last rating that counts for anything |
| 10 reps @ 5+ RIR | **not counted** | Too far from failure to be training. This is a warm-up |
| 3 reps @ 0 RIR | **3** | Capped at the reps you actually did, not credited 5 |
| 1 rep @ 0 RIR | **1** | A heavy single |
| 10 reps, **no RIR** | **not scored** | Unknown, not zero — see below |
| Set never ticked off | **not scored** | It didn't happen |

### Above 4 RIR, a set counts for nothing

Not zero effective reps — *nothing*. It is not a working set, it carries no volume, and it
cannot set a personal record. A set five or more reps from failure is moving weight rather
than training, which is the line the reference takes in its section on intensity.

This rule replaced a manual warm-up checkbox. An easy set now says so through its rating
instead of through a tick box, which is one less thing to remember mid-session. The
`is_warmup` column still exists and old rows that carry it are still honoured; nothing
writes it any more.

### The null cases are the important part

A set you didn't rate says *nothing* about how close to failure it was. Scoring it as zero
would be a claim — and a wrong one, that quietly drags every total down. So it is scored as
`null` and stays out of every sum.

That creates a second problem: a low total is now ambiguous between "I trained easy" and
"I didn't rate much". So **every screen that shows a total also shows how many sets it was
able to score**:

> **12** effective reps
> 3 of 4 working sets rated — unrated sets count nothing

A total is a floor, never a measurement, and the app says so wherever it prints one.

### RIR runs 0–5, not 0–4

RIR 5 means "5 or more left in the tank". It exists so an easy set has somewhere to go: it
is the value that drops a set out of the numbers entirely. On a 0–4 scale every logged set
would count, and junk volume could never show up as junk.

### One rule, two languages

The rule lives in `lib/effective-reps.ts` and is written twice:

| TypeScript | SQL | What it decides |
|---|---|---|
| `effectiveReps()` | `effectiveRepsSQL` | What one set scores |
| `isCountedSet()` | `countedSetSQL` | Whether a set counts at all |

The TypeScript forms are what the screens render through; the SQL forms are what the stats
aggregates sum in Postgres, so a year of training doesn't have to be pulled into Node to be
totalled.

They are the same rules in two languages, which means they can drift — and a drift here is
invisible, because both sides return a plausible number and only disagree about which sets
to count. **`npm run check` asserts they agree**, on every case in the table above, in
Postgres as well as in Node. Run it after touching either form.

That check is not hypothetical. The two forms *did* diverge once, during the build:

```sql
-- wrong
greatest(0, least(reps, 5 - rir))
```

Postgres `least()` and `greatest()` **ignore** NULL arguments rather than propagating them.
So for an unrated set, `least(10, 5 - NULL)` collapses to `least(10, NULL)` → `10`. An
unrated 10-rep set scored **10** in every stats total while scoring **nothing** on the log
screen — and the "3 of 4 sets rated" line was printed directly beneath a number that had
already counted all 4. The one guardrail against misreading the total was the thing lying
about it.

```sql
-- right
CASE WHEN is_warmup OR NOT is_completed OR rir IS NULL OR rir > 4 THEN NULL
     ELSE greatest(0, least(reps, 5 - rir))
END
```

Effective reps are **never stored in a column**. They are derived from `reps` and `rir` on
every read, so there is nothing to migrate and nothing to drift.

---

## Reference bands

`lib/targets.ts` holds the only numbers in the app that describe what training *should*
look like. They come from *Hypertrophy Training — Principles That Work* (2026 reference
edition), and they are used to colour bars and label ranges — never to propose a load.

| Constant | Value | Meaning |
|---|---|---|
| `WEEKLY_SETS_FLOOR` | 5 | Hard sets per muscle per week, below which training maintains at best |
| `WEEKLY_SETS_LOW`–`WEEKLY_SETS_HIGH` | 10–16 | The productive range for most lifters |
| `SESSION_ER_LOW`–`SESSION_ER_HIGH` | 20–40 | Effective reps per muscle per session |
| `FREQUENCY_TARGET` | 2 | Sessions per muscle per week |
| `HARD_SET_MAX_RIR` | 3 | A "hard set" finished within three reps of failure |

Bars run green in range, amber under or over, red below the floor. `getMuscleTotals`
returns `hardSets` and `sessions` so the per-muscle rows can be measured against them.

---

## Screens

| Route | What it does |
|---|---|
| `/` | **Today.** Three weekly numbers, then the program card — swipeable between programs, opening on the one trained most recently. Tap a day to start it, or **Start** for the week. Hard sets per muscle and recent workouts sit in fold-out drawers below. |
| `/start` | **The week.** Every day of the chosen program as a compact row: name, lift count, when it was last trained, its lifts. Freestyle at the bottom. Redirects into the open session if one exists. |
| `/log/[id]` | **The session.** The day as a list of lifts. See below. |
| `/log/[id]/[logId]` | **One lift.** Where sets are tracked and last session is read. See below. |
| `/history` | Every finished session, newest first, with its top muscle groups. |
| `/history/[id]` | One session in full — effective reps by muscle, then every set with its RIR and score. |
| `/programs` | Program list. Pin, open or duplicate. |
| `/programs/[id]` | One program: its name, its days in order (drag to reorder), and what the week adds up to per muscle against the bands. |
| `/programs/[id]/days/[dayId]` | **One day.** The only place lifts are added, ordered or removed. See below. |
| `/programs/new` | Name it; days come next. |
| `/stats` | Per-muscle hard sets, effective reps per week and per session, and training frequency over 7 / 30 / 365 days. Effective reps by week and by lift. Personal records. Bodyweight. |
| `/exercises` | **The exercise base.** Every lift with how much it is used, an Unused filter, add, edit and delete. |
| `/settings` | **More.** A hub: the exercise base and programs as rows, then kg/lb, default rest, RIR tracking, sign out. |
| `/login` | The passcode gate. The only page outside it. |

The bottom bar runs **Programs · History · Today · Stats · More**, with Today raised out of
the bar as a filled circle — it is where every workout starts and the only tab reached
mid-session.

---

## The gym: two screens

Starting a day opens **a list of lifts**, not a page of set grids. One row each: position,
name, muscle, how many sets are done against how many are planned, the last set you did and
what the lift has scored. The whole row is the link. Tapping it opens **the lift**, which is
where sets are tracked — a screen with room for last session's complete set list beside
today's.

Above the sets sits **the lift's own note** — setup cues, what to watch. It belongs to the
lift, not to the day, so it is there unchanged every time that exercise comes round, until
you edit it. It is the same note the exercise base keeps, editable from either place. A
lift logged as a one-off has no library row to keep a note on, so it gets no box; its ⋯
drawer still has a note for that session alone, which is kept with that session's history.

The left column is the whole of the previous session, not its top set, because the question
in the gym is "what did I do for set three last time" and reading it off the screen beats
the app guessing for you.

Sets are entered through a **sheet**, never inline — weight × reps as two typed fields,
then the RIR chips, with the effective reps the set will score shown before you save it.
Saving writes weight, reps, rating and completion in one call, so nothing lands half-saved,
and starts the rest timer. A bigger screen is not a reason to put number boxes back in the
card.

Details that are easy to break:

- **The sheet prefills from this session's previous set**, never from last week. Last
  week's numbers are on the left to be read, not applied. That distinction is where the
  no-suggestions line sits.
- **A program day's planned rows are filled in order** before new sets are appended, so the
  plan is consumed rather than sitting empty beside what actually happened.
- **The rating chips don't take focus.** They call `preventDefault` on mousedown, so the
  keyboard stays up and the sheet doesn't drop and bounce on every tap.
- **The sheet sits above the keyboard.** iOS Safari doesn't shrink the layout viewport when
  the keyboard opens, so a fixed sheet pinned to the bottom ends up behind it.
  `useKeyboardInset` reads `window.visualViewport` and lifts the sheet by however much is
  covered; the body scrolls and the buttons are pinned outside that scroll.
- **The rest survives the walk between the two screens.** The countdown's end timestamp
  lives in `localStorage`, not in React state, so stepping back to the session list to
  check the total doesn't cancel it.
- **The session's server actions revalidate the layout, not the page.**
  `revalidatePath("/log/<id>")` alone doesn't reach `/log/<id>/<logId>`, and a set logged
  on the lift screen would appear to do nothing.

A running effective-rep total and a per-muscle breakdown stay pinned at the top of the
session list. The rest timer floats at the bottom of both screens, and the tab bar is
hidden across `/log/` — Finish is at the bottom of the session page and a nav bar under it
invites a mis-tap out of a live workout.

---

## The program editor

A program is a name and a list of days; **each day is edited on its own page**. That split
is not cosmetic. `saveProgramDay` replaces one day's name and planned rows and leaves the
rest alone, where the old whole-program save deleted and reinserted *every* day — which
detached every past session from the `day_id` it was started from.

On a day page each row is the lift name and a **muscle-group chip beside it**, with sets
and reps folded away behind a `3 × 10` summary that opens on a tap. A day list is scanned
for which lifts are in it and in what order, not for rep schemes.

**Save day is explicit**, and the button is also the dirty flag: `No changes`, then
`Save day`, then `Saved`, with a warning line while there is unsaved work.

### Adding lifts

`+ Add lifts` opens a multi-select picker — muscle-group chips, name search, a tick per row
and an `Add N lifts` footer, so a day is filled in one visit. `+ New exercise` is always in
that list and opens a dialog with its own name field, seeded from the search box and the
active group chip. The new lift is written to the library and comes back **already
selected**, so it is never searched for twice.

Near-duplicates are caught before saving: names are compared with every non-alphanumeric
character stripped, so `bench-press` finds `Bench Press` and offers to use it instead. The
unique index only ever caught the difference in capitalisation.

### Dragging

Reordering is by a handle, on both the day list and the lift list, and it is built on
pointer events — HTML5 drag-and-drop does not exist on touch. Three details make it usable
on a phone:

- The handle **captures the pointer**, so the drag survives the finger leaving the row.
- `touch-action: none` on the handle stops the page scrolling underneath it.
- Selection is switched off on `document.body` for the length of the drag. Without it a
  drag starting near the text selects it, magnifier and copy bubble included. `select-none`
  on the handle alone does nothing, because the pointer leaves the handle immediately.

The list reorders live as you cross a neighbour, and `onSettle` fires once at the end,
which is where the save goes.

---

## The exercise base

`/exercises`, the first row under **More**. Every entry carries how much it is actually
used — how many programs plan it, how many sessions contain it — and **Unused** is a filter
of its own. That is what the page is for: finding the typo saved in a hurry from a picker
and getting rid of it.

Its **notes** field is the standing note the gym screen shows above the sets — the same
text either way, so a cue written mid-session while you remember it is there on the
library row afterwards.

Deleting is a two-step confirm that says what survives. `exercise_id` is `ON DELETE SET
NULL` everywhere and both history and programs keep their own copy of the name, so removing
a lift only stops it appearing in the pickers.

---

## Setup

Requires Node 20+ and a Neon Postgres database.

```bash
git clone https://github.com/vladimirbrusov83-hub/Iron_log_web.git
cd Iron_log_web
npm install
```

Create `.env.local`:

```bash
DATABASE_URL=      # Neon POOLED connection string (hostname contains "-pooler")
APP_PASSCODE=      # whatever you want to type at /login
```

Then:

```bash
npm run db:push    # applies db/schema.sql, seeds 45 exercises + 3 preset programs
npm run check      # asserts the two forms of the effective-reps rule agree
npm run dev        # http://localhost:3000
```

### `db:push` is idempotent, and it is a manual step

Re-running it adds nothing and overwrites nothing. An exercise you renamed keeps its name;
a preset program you edited is skipped whole rather than reset.

**One database serves both local and production, and Vercel never runs this script.** So
when a schema change goes out, run `npm run db:push` *before* pushing the code that reads
the new column — otherwise production deploys first and queries a column that isn't there.

### The preset seed

45 exercises across 8 muscle groups, and three programs ported from the iOS app: Full Body
3×/week, Upper/Lower 4×/week, and Push/Pull/Legs 6×/week. All of it is editable; none of it
is special. The data lives in `db/seed.mjs`.

### Testing against a throwaway database

The same database serves local and production, so anything you do while developing lands in
real training history. To test writes safely, create a second database in the same Neon
project, point a scratch env file at it, and drop it afterwards:

```bash
# CREATE DATABASE ironlog_scratch;  then:
DATABASE_URL=<same url with /ironlog_scratch> npm run db:push
```

---

## Access and the passcode

One passcode, no accounts — one person uses this app, and a phone's "device = identity"
assumption doesn't survive being put on a public URL.

`middleware.ts` puts **every** route behind the gate; `/login` is the only exception.
The cookie does not contain the passcode — it holds an HMAC of a fixed string keyed by it,
so the cookie is useless anywhere else and changing `APP_PASSCODE` signs out every browser
that was open. Comparisons are constant-time, and both sides are hashed first so the real
passcode's length never shows through.

This is deliberately modest security: it is one shared secret, and anyone holding it is in.
It is the right size for a training log and the wrong size for anything with other people's
data in it.

---

## Project layout

```
app/
├── page.tsx              today — stats, program carousel, drawers
├── start/page.tsx        the week: pick a day to start
├── log/[id]/
│   ├── page.tsx          loads the session
│   ├── workout.tsx       the day as a list of lifts (client)
│   └── [logId]/
│       ├── page.tsx      loads one lift, last time's sets and its note
│       └── exercise.tsx  tracking one lift, its note and the set sheet (client)
├── history/              list + one session
├── programs/
│   ├── page.tsx          list, pin, duplicate
│   ├── new/page.tsx      name a new program
│   └── [id]/
│       ├── page.tsx      loads the program
│       ├── program.tsx   name, day order (client)
│       └── days/[dayId]/
│           ├── page.tsx  loads the day
│           └── day.tsx   the day editor (client)
├── stats/
│   ├── page.tsx          per-muscle bands, aggregates, PRs
│   └── bodyweight.tsx    log and list (client)
├── exercises/            the library (client)
├── settings/             preferences + sign out
├── login/                the gate
└── actions.ts            every server action, each clamping its own input

lib/
├── effective-reps.ts     the scoring and counting rules, TS and SQL
├── targets.ts            the reference bands from the paper
├── db.ts                 all SQL — queries and writes
├── types.ts              shared shapes, Epley e1RM, volume, duration
└── auth.ts               passcode + cookie (Web Crypto — middleware runs on the edge)

components/
├── nav.tsx               bottom tab bar, Today raised in the middle
├── program-carousel.tsx  swipeable program card (client)
├── exercise-picker.tsx   multi-select picker + new-exercise dialog (client)
├── drag-list.tsx         useDragReorder + DragHandle, pointer-event reordering
├── rest-timer.tsx        countdown, beep, vibrate
└── ui.tsx                Page, Panel, Button, Stat, Bar, band bars, input styles

db/
├── schema.sql            the whole schema, commented
└── seed.mjs              preset exercises and programs (data only)

scripts/
├── db-push.mjs           applies the schema, seeds
└── check-effective-reps.mjs   TS↔SQL parity check
```

---

## Data model

```
settings            one row, id fixed at 1 — unit, default rest, RIR on/off
bodyweight_entries  one per day

exercises           the library (unique on lower(name))

programs
 └── program_days
      └── planned_exercises

sessions
 └── exercise_logs
      └── set_logs          weight, reps, rir, rpe, is_warmup, is_completed

personal_records
```

### Why it looks like that

**`rir` is nullable, never `-1`.** The iOS app used `-1` as a "not tracked" sentinel.
Carried into SQL that becomes `5 - (-1) = 6`, and unrated sets would have scored *more*
than sets taken to failure. NULL is the only value that keeps them out of a `SUM` instead
of corrupting it.

**`is_warmup` is legacy.** Nothing writes it since the warm-up checkbox was replaced by the
over-4-RIR rule, but rows that carry it are still excluded everywhere, so old sessions read
the way they were logged.

**Sets are real rows with real columns**, not a `jsonb` blob. The sibling project
ClientProgram stores per-set ratings as `jsonb` precisely because nothing reads them; here
the stats page aggregates `reps` and `rir` in SQL, so they have to be columns.

**At most one unfinished session**, enforced by a partial unique index rather than by
whichever screen remembers to check:

```sql
CREATE UNIQUE INDEX sessions_one_active_key
  ON sessions ((finished_at IS NULL)) WHERE finished_at IS NULL;
```

`startSession` returns the open session's id instead of inserting, so tapping **Start**
twice lands in the same workout rather than on an error page, and `/start` redirects
straight into it.

**Sessions snapshot `day_name` and `program_name`.** Rename a program six months later, or
delete it, and history still reads the way it happened. Foreign keys to programs and days
are `ON DELETE SET NULL` for the same reason.

**Deleting a lift from the library doesn't delete it from your programs.**
`planned_exercises.exercise_id` is `ON DELETE SET NULL` and the row carries its own name, so
the day still reads correctly afterwards.

**Finishing a session** drops sets that were never ticked off, drops exercises left with
nothing logged, then records personal records — the best set per lift by estimated 1RM
(Epley), compared against *earlier sessions only* so tapping Finish twice can't let a record
beat itself. Duration is computed from `started_at` in SQL, not from a number the browser
sends, so a phone that slept through half the session still gets it right.

---

## Design decisions worth knowing

**Barlow Condensed for display, Barlow for body**, loaded through `next/font`. Every large
number is condensed and tabular; `.display`, `.eyebrow` and `.tnum` in `app/globals.css`
are the three utilities that carry the look. Dark only — the iOS app was a black,
industrial thing and this is the same app. A light theme would be a different product.

**The rest timer never decrements.** It stores an end timestamp and derives the remaining
time from the clock on every tick, including on `visibilitychange`. iOS Safari throttles or
stops `setInterval` on a locked phone, and a counter that subtracts one per tick comes back
minutes wrong.

**There are no haptics on iOS Safari.** `navigator.vibrate` is a no-op there, so the Web
Audio beep carries the alert alone — three short pips, audible over gym noise. It only
works because the `AudioContext` is created inside the tap that starts the timer; created
any later, iOS silently drops it.

**The program carousel is native scroll-snap**, not a gesture handler: momentum,
rubber-banding and mid-swipe reversal all come free. It is a fixed height whatever the
program, so nothing below it moves when you swipe, and a program with more days than fit
scrolls its list inside the card.

**`logSet` is the only way a set is written.** Weight, reps, rating and completion go up
together. A two-write path would race two revalidations on the same row and land sets
half-saved.

**`updateSet` takes a partial patch.** Absent fields use `COALESCE` against a typed NULL —
except `rir` and `rpe`, where NULL is a *real value* meaning "not rated". Those use an
explicit `"rir" in patch` flag. Collapsing the two would wipe a rating on any partial save.

**Stats aggregates use `sql.query(text, params)`, not tagged templates.** `effectiveRepsSQL`
and `countedSetSQL` are SQL *fragments*, and the neon driver has no fragment type —
interpolated into a tagged template they would be sent as string *values*. Only module
constants built from numbers are ever interpolated into query text; nothing a request
carries goes near it.

**Saving a day replaces only that day's planned rows.** Nothing references
`planned_exercises` — a session copies what it needs the moment it starts — so deleting and
reinserting them is safe, and the `program_days` row keeps its id, so sessions started from
that day stay attached to it. The older whole-program `saveProgram` still exists, but only
`duplicateProgram` uses it.

**Number inputs are `font-size: 16px` minimum.** Below that iOS Safari zooms the whole page
when one is focused, which in a gym means fighting the viewport between sets.

**No z-index on the page wrapper.** The root layout wraps pages in a plain `relative` div.
It used to be `relative z-10`, which made a stacking context and pinned every `z-50` picker
and sheet underneath the `z-40` nav bar — the picker's Add button was physically
unclickable. The gym screens never showed it because they hide the nav.

**Drawers are native `<details>`.** The home screen's two collapsible sections cost no
JavaScript and work before the page finishes hydrating. Each carries its headline on the
summary row, so the page reads without opening them.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the build |
| `npm run db:push` | Apply `db/schema.sql` and seed. Idempotent |
| `npm run check` | Assert the TS and SQL forms of the effective-reps rule agree |

---

## Deploying

Push to `main`; Vercel picks it up in about 30 seconds. Set `DATABASE_URL` and
`APP_PASSCODE` in the Vercel project's environment variables — the same Neon database serves
local and production.

Run `npm run db:push` **before** pushing code that reads a new column.

---

## Credits

Built by Vladimir Brusov — strength coach. Ported from the SwiftUI/SwiftData original.
The volume, effort and effective-rep ranges come from his own reference,
*Hypertrophy Training — Principles That Work* (2026 edition).
