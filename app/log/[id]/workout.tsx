"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addExercise, discardWorkout, finishWorkout, noteSession } from "@/app/actions";
import { RestTimer } from "@/components/rest-timer";
import { WorkoutClock } from "@/components/workout-clock";
import { BAND_COLOR, BackLink, Button, inputClass } from "@/components/ui";
import {
  MAX_RIR, effectiveRepsByMuscle, effectiveRepsCoverage, isCountedSet, totalEffectiveReps,
} from "@/lib/effective-reps";
import { SESSION_ER_HIGH, SESSION_ER_LOW, sessionErBand } from "@/lib/targets";
import { MUSCLE_GROUPS, setVolume } from "@/lib/types";
import type { Exercise, ExerciseLog, Session, Settings } from "@/lib/types";

type Props = {
  session: Session;
  settings: Settings;
  library: Exercise[];
};

/**
 * The live session, as a list of lifts.
 *
 * This screen answers "what am I doing today and how far in am I". Sets are
 * not entered here: tapping a lift opens `/log/[id]/[logId]`, which has room
 * for last session's full set list beside today's. Vladimir asked for that
 * split in September 2026 — the old two-column cards stacked down one page
 * left no room to read either side.
 */
export function Workout({ session, settings, library }: Props) {
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
  const unit = settings.weightUnit;

  const allSets = session.exercises.flatMap((e) => e.sets);
  const dayTotal = totalEffectiveReps(allSets);
  const coverage = effectiveRepsCoverage(allSets);
  const byMuscle = effectiveRepsByMuscle(session.exercises);
  const volume = allSets.reduce((sum, s) => sum + setVolume(s), 0);
  const run = (fn: () => void) => startTransition(fn);

  return (
    <>
      {/* Sticky scoreboard. The one number this rebuild exists for stays on
          screen while the exercise list scrolls under it. The coverage line is
          not decoration: without it a low total is ambiguous between an easy
          session and an unrated one. */}
      <div
        className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <BackLink href="/" label={session.programName || "Freestyle"} className="min-w-0" />
            <WorkoutClock startedAt={session.startedAt} />
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="display mt-0.5 truncate text-3xl font-semibold">{session.dayName}</h1>
              <p className="tnum mt-0.5 text-xs text-ink-faint">
                {Math.round(volume).toLocaleString("en-US")} {unit}
                {" · "}{coverage.scored}/{coverage.working} rated
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="display tnum text-5xl font-semibold leading-none text-accent">
                {dayTotal}
              </div>
              <div className="eyebrow" style={{ fontSize: 9 }}>effective reps</div>
            </div>
          </div>

          {byMuscle.length > 0 && (
            <ul className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
              {byMuscle.map((m) => {
                const band = sessionErBand(m.effectiveReps);
                return (
                  <li
                    key={m.muscleGroup}
                    className="flex shrink-0 items-baseline gap-1.5 rounded-lg border border-line
                               bg-panel px-2 py-1 text-xs"
                    title={`${SESSION_ER_LOW}–${SESSION_ER_HIGH} effective reps per muscle per session`}
                  >
                    <span className="text-ink-dim">{m.muscleGroup}</span>
                    <span className={`display tnum text-base font-semibold ${BAND_COLOR[band]}`}>
                      {m.effectiveReps}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pt-4" style={{ paddingBottom: "7.5rem" }}>
        <ul className="space-y-2">
          {session.exercises.map((log, i) => (
            <li key={log.id}>
              <ExerciseRow sessionId={session.id} log={log} index={i} unit={unit} />
            </li>
          ))}
        </ul>

        {session.exercises.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line-2 px-4 py-10 text-center text-sm text-ink-faint">
            Nothing logged yet. Add a lift to begin.
          </p>
        )}

        <div className="mt-4 space-y-3">
          <Button className="w-full" onClick={() => setPicking(true)}>
            <span className="display text-lg leading-none">+</span> Add exercise
          </Button>

          <textarea
            defaultValue={session.notes}
            placeholder="Session notes"
            rows={2}
            className={`${inputClass} py-2 text-sm`}
            onBlur={(e) => {
              const value = e.target.value;
              if (value !== session.notes) run(() => { void noteSession(session.id, value); });
            }}
          />

          <Button
            variant="primary"
            className="w-full"
            disabled={pending}
            onClick={() => run(() => { void finishWorkout(session.id); })}
          >
            Finish workout
          </Button>

          {/* Destructive and permanent, so it asks first and never sits next to
              "Finish" as an equal-looking button. */}
          <Button
            variant="ghost"
            className="w-full text-bad"
            disabled={pending}
            onClick={() => {
              if (confirm("Discard this workout? Everything logged in it is deleted.")) {
                run(() => { void discardWorkout(session.id); });
              }
            }}
          >
            Discard workout
          </Button>
        </div>
      </main>

      {/* The timer floats over the list so it is readable between sets without
          scrolling back up. It is the same rest as the one on the exercise
          screen — the countdown is stored, not held in this component. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 px-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto max-w-2xl shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)]">
          <RestTimer defaultSeconds={settings.defaultRestSeconds} />
        </div>
      </div>

      {picking && (
        <ExercisePicker
          library={library}
          onClose={() => setPicking(false)}
          onPick={(exerciseId, name, muscleGroup) => {
            setPicking(false);
            run(() => { void addExercise(session.id, exerciseId, name, muscleGroup); });
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------- row */

/**
 * One lift in the day's list: where it sits, what it is, how far through it is
 * and what it has scored. The whole row is the link into the tracking screen —
 * nothing on it is separately tappable, so a thumb cannot miss.
 *
 * The last set done is shown because it is the one thing worth reading without
 * opening the lift; it is a record of what happened, not a suggestion.
 */
function ExerciseRow({
  sessionId, log, index, unit,
}: {
  sessionId: string;
  log: ExerciseLog;
  index: number;
  unit: string;
}) {
  const done = log.sets.filter((s) => s.isCompleted);
  const working = done.filter(isCountedSet).length;
  const planned = Math.max(log.plannedSets, 0);
  const score = totalEffectiveReps(log.sets);
  const lastSet = done[done.length - 1];

  return (
    <Link
      href={`/log/${sessionId}/${log.id}`}
      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${
        log.isDone
          ? "border-good/60 bg-good/10 active:bg-good/20"
          : "border-line bg-panel active:bg-panel-2"
      }`}
    >
      <span className={`display tnum w-5 shrink-0 text-sm font-semibold ${
        log.isDone ? "text-good" : "text-ink-faint"
      }`}>
        {log.isDone ? "✓" : String(index + 1).padStart(2, "0")}
      </span>

      <span className="min-w-0 flex-1">
        <span className="display block truncate text-lg font-semibold leading-tight">
          {log.name}
        </span>
        <span className="tnum block truncate text-[11px] text-ink-faint">
          {log.muscleGroup}
          {planned > 0 ? ` · ${working}/${planned} sets` : ` · ${working} sets`}
          {lastSet && (
            <>
              {" · last "}
              {lastSet.weight} {unit} × {lastSet.reps}{lastSet.restPauseReps > 0 && ` + ${lastSet.restPauseReps}`}
              {lastSet.rir !== null && ` @${lastSet.rir === MAX_RIR ? `${MAX_RIR}+` : lastSet.rir}`}
            </>
          )}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className={`display tnum block text-2xl font-semibold leading-none ${
          score ? "text-accent" : "text-ink-faint"
        }`}>
          {score}
        </span>
        <span className="eyebrow block" style={{ fontSize: 9 }}>eff reps</span>
      </span>

      <span className="shrink-0 text-lg text-ink-faint" aria-hidden>›</span>
    </Link>
  );
}

/* ---------------------------------------------------------------- picker */

function ExercisePicker({
  library, onPick, onClose,
}: {
  library: Exercise[];
  onPick: (id: string | null, name: string, muscleGroup: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const groups = MUSCLE_GROUPS.filter((m) => library.some((e) => e.muscleGroup === m));
  const matches = library.filter((e) =>
    (q === "" || e.name.toLowerCase().includes(q)) && (group === null || e.muscleGroup === group));
  const exact = library.some((e) => e.name.toLowerCase() === q);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-md"
         style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-4">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or type a new lift"
            className={inputClass}
          />
          <Button onClick={onClose}>Close</Button>
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {[null, ...groups].map((g) => (
            <button
              key={g ?? "all"}
              onClick={() => setGroup(g)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                group === g ? "border-accent text-accent" : "border-line-2 text-ink-dim"
              }`}
            >
              {g ?? "All"}
            </button>
          ))}
        </div>

        <div className="mt-2 flex-1 overflow-y-auto pb-6">
          {q !== "" && !exact && (
            <button
              onClick={() => onPick(null, query.trim(), group ?? "Other")}
              className="mb-2 w-full rounded-xl border border-dashed border-accent/50 px-3 py-3
                         text-left text-sm text-accent"
            >
              Log &ldquo;{query.trim()}&rdquo; as a one-off
              <span className="block text-[11px] text-ink-faint">
                Not added to the library — do that on the Exercises page.
              </span>
            </button>
          )}
          <ul className="space-y-1">
            {matches.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => onPick(e.id, e.name, e.muscleGroup)}
                  className="flex w-full items-center justify-between rounded-xl border
                             border-line bg-panel px-3 py-3 text-left active:bg-panel-2"
                >
                  <span className="truncate">{e.name}</span>
                  <span className="ml-2 shrink-0 text-[11px] text-ink-faint">{e.muscleGroup}</span>
                </button>
              </li>
            ))}
          </ul>
          {matches.length === 0 && q === "" && (
            <p className="py-8 text-center text-sm text-ink-faint">
              The library is empty. Run <code>npm run db:push</code>, or add lifts on{" "}
              <Link href="/exercises" className="text-accent underline">Exercises</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
