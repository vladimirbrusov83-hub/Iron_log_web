# IronLog

A strength training log for the web. You log sets, reps, weight and RIR in the gym; it
counts **effective reps** from what you logged and shows you where they went.

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
- [Screens](#screens)
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
```

| Set logged | Score | Why |
|---|---|---|
| 10 reps @ 0 RIR | **5** | Taken to failure — the last 5 reps counted |
| 10 reps @ 1 RIR | **4** | |
| 10 reps @ 2 RIR | **3** | |
| 10 reps @ 4 RIR | **1** | |
| 10 reps @ 5+ RIR | **0** | Genuinely easy. Nothing stimulating happened |
| 3 reps @ 0 RIR | **3** | Capped at the reps you actually did, not credited 5 |
| 1 rep @ 0 RIR | **1** | A heavy single |
| 10 reps, **no RIR** | **not scored** | Unknown, not zero — see below |
| Warmup set | **not scored** | Not part of the working stimulus |
| Set never ticked off | **not scored** | It didn't happen |

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

RIR 5 means "5 or more left in the tank". It exists so a genuinely easy set can score zero.
On a 0–4 scale every logged set scores at least 1, the zero case is unreachable, and junk
volume can never show up in the numbers.

### One rule, two languages

The rule lives in `lib/effective-reps.ts` and is written twice:

- a **TypeScript function** the log screen and history render through, and
- **`effectiveRepsSQL`**, a SQL expression the stats aggregates sum in Postgres, so a
  year of training doesn't have to be pulled into Node to be totalled.

They are the same rule in two languages, which means they can drift — and a drift here is
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
CASE WHEN is_warmup OR NOT is_completed OR rir IS NULL THEN NULL
     ELSE greatest(0, least(reps, 5 - rir))
END
```

Effective reps are **never stored in a column**. They are derived from `reps` and `rir` on
every read, so there is nothing to migrate and nothing to drift.

---

## Screens

| Route | What it does |
|---|---|
| `/` | Today. Start a workout from the pinned program's days or freestyle; 7-day totals; recent sessions. Shows a "workout in progress" card if one is open. |
| `/log/[id]` | **The gym screen.** Per-exercise cards, a set grid (weight · reps · RIR · effective reps · tick), rest timer, running effective-rep total at the top. Built for one hand at 375px. |
| `/history` | Every finished session, newest first. |
| `/history/[id]` | One session in full — every set, its RIR and its score. |
| `/programs` | Program list. Pin one to make it the home screen's offer. |
| `/programs/[id]`, `/programs/new` | Day and exercise editor with reorder, planned sets × reps, and a weekly per-muscle set count. |
| `/stats` | Effective reps by week, by muscle group and by lift, over 7 / 30 / 365 days. Personal records. Bodyweight. |
| `/exercises` | The library — 45 seeded lifts plus anything you add. |
| `/settings` | kg/lb, default rest, RIR tracking on/off, sign out. |
| `/login` | The passcode gate. The only page outside it. |

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
├── page.tsx              today
├── log/[id]/
│   ├── page.tsx          loads the session
│   └── workout.tsx       the gym screen (client)
├── history/              list + one session
├── programs/
│   ├── page.tsx          list, pin, duplicate
│   └── editor.tsx        day/exercise editor (client)
├── stats/
│   ├── page.tsx          aggregates + PRs
│   └── bodyweight.tsx    log and list (client)
├── exercises/            the library (client)
├── settings/             preferences + sign out
├── login/                the gate
└── actions.ts            every server action, each clamping its own input

lib/
├── effective-reps.ts     the scoring rule, TS and SQL
├── db.ts                 all SQL — queries and writes
├── types.ts              shared shapes, Epley e1RM, volume, duration
└── auth.ts               passcode + cookie (Web Crypto — middleware runs on the edge)

components/
├── nav.tsx               bottom tab bar
├── rest-timer.tsx        countdown, beep, vibrate
└── ui.tsx                Page, Panel, Button, Stat, Bar, input styles

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
twice lands in the same workout rather than on an error page.

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

**The rest timer never decrements.** It stores an end timestamp and derives the remaining
time from the clock on every tick, including on `visibilitychange`. iOS Safari throttles or
stops `setInterval` on a locked phone, and a counter that subtracts one per tick comes back
minutes wrong.

**There are no haptics on iOS Safari.** `navigator.vibrate` is a no-op there, so the Web
Audio beep carries the alert alone — three short pips, audible over gym noise. It only
works because the `AudioContext` is created inside the tap that starts the timer; created
any later, iOS silently drops it.

**`updateSet` takes a partial patch.** Absent fields use `COALESCE` against a typed NULL —
except `rir` and `rpe`, where NULL is a *real value* meaning "not rated". Those use an
explicit `"rir" in patch` flag. Collapsing the two would wipe a rating every time the weight
box saved.

**Stats aggregates use `sql.query(text, params)`, not tagged templates.** `effectiveRepsSQL`
is a SQL *fragment*, and the neon driver has no fragment type — interpolated into a tagged
template it would be sent as a string *value*. Only module constants built from numbers are
ever interpolated into query text; nothing a request carries goes near it.

**Editing a program deletes and reinserts its days.** Safe because sessions reference
`day_id` with `ON DELETE SET NULL` and keep their own name snapshot, so old sessions detach
cleanly rather than breaking or silently re-pointing.

**The set grid is six columns at 375px.** Number inputs are `font-size: 16px` minimum —
below that iOS Safari zooms the whole page when one is focused, which in a gym means
fighting the viewport between sets. Deleting a set is behind the set-number button rather
than a seventh column, for the same reason.

**Dark only.** The iOS app was a black, industrial thing and this is the same app. A light
theme would be a different product.

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
