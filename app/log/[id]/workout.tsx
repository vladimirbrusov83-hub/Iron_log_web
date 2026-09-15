"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  addExercise, discardWorkout, dropExercise, finishWorkout,
  logSet, noteExercise, noteSession, removeSet,
} from "@/app/actions";
import { RestTimer } from "@/components/rest-timer";
import { BAND_COLOR, Button, inputClass } from "@/components/ui";
import {
  EFFECTIVE_REP_THRESHOLD, MAX_RIR, effectiveReps, effectiveRepsByMuscle,
  effectiveRepsCoverage, totalEffectiveReps,
} from "@/lib/effective-reps";
import { SESSION_ER_HIGH, SESSION_ER_LOW, sessionErBand } from "@/lib/targets";
import { setVolume } from "@/lib/types";
import type { LastSession } from "@/lib/db";
import type { Exercise, ExerciseLog, Session, SetLog, Settings } from "@/lib/types";

type Props = {
  session: Session;
  settings: Settings;
  library: Exercise[];
  lastTime: Record<string, LastSession>;
};

/** The set the sheet is open on: an existing row to edit, or a new one. */
type SheetTarget = {
  log: ExerciseLog;
  set: SetLog | null;
  setNumber: number;
  /** The row to write into when one is already laid out by a program day. */
  fillId: string | null;
  weight: number;
  reps: number;
  rir: number | null;
  isWarmup: boolean;
};

export function Workout({ session, settings, library, lastTime }: Props) {
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [restKey, setRestKey] = useState(0);
  const unit = settings.weightUnit;

  const allSets = session.exercises.flatMap((e) => e.sets);
  const dayTotal = totalEffectiveReps(allSets);
  const coverage = effectiveRepsCoverage(allSets);
  const byMuscle = effectiveRepsByMuscle(session.exercises);
  const volume = allSets.reduce((sum, s) => sum + setVolume(s), 0);
  const elapsed = useElapsedMinutes(session.startedAt);
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
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <Link href="/" className="eyebrow text-accent">
                ‹ {session.programName || "Freestyle"}
              </Link>
              <h1 className="display mt-0.5 truncate text-3xl font-semibold">{session.dayName}</h1>
              <p className="tnum mt-0.5 text-xs text-ink-faint">
                {elapsed} min · {Math.round(volume).toLocaleString()} {unit}
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
        <div className="space-y-3">
          {session.exercises.map((log, i) => (
            <ExerciseCard
              key={log.id}
              index={i}
              log={log}
              sessionId={session.id}
              unit={unit}
              last={lastTime[log.name.toLowerCase()]}
              run={run}
              onOpenSet={setSheet}
            />
          ))}
        </div>

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
          scrolling back up. It starts itself when a set is saved. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 px-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto max-w-2xl shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)]">
          <RestTimer defaultSeconds={settings.defaultRestSeconds} autoStartKey={restKey} />
        </div>
      </div>

      {sheet && (
        <SetSheet
          target={sheet}
          unit={unit}
          trackRir={settings.trackRir}
          last={lastTime[sheet.log.name.toLowerCase()]}
          onClose={() => setSheet(null)}
          onDelete={() => {
            const id = sheet.set?.id;
            setSheet(null);
            if (id) run(() => { void removeSet(session.id, id); });
          }}
          onSave={(values) => {
            const isNew = !sheet.set;
            setSheet(null);
            run(() => { void logSet(session.id, sheet.log.id, sheet.set?.id ?? sheet.fillId, values); });
            // Rest starts when a set is recorded, not when one is corrected.
            if (isNew && !values.isWarmup) setRestKey((k) => k + 1);
          }}
        />
      )}

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

/** Minutes since the session started, refreshed twice a minute. */
function useElapsedMinutes(startedAt: string): number {
  const compute = () => Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  const [minutes, setMinutes] = useState(compute);
  useEffect(() => {
    const id = setInterval(() => setMinutes(compute()), 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);
  return minutes;
}

/* ------------------------------------------------------------------ card */

/**
 * One lift, as two columns: what you did last time on the left, what you have
 * done today on the right.
 *
 * The left column is the whole of the previous session's list, not its top set,
 * because the question in the gym is "what did I do for set three last time",
 * and reading it off the screen beats the app guessing for you. Nothing here
 * proposes a load — it only shows what already happened.
 */
function ExerciseCard({
  index, log, sessionId, unit, last, run, onOpenSet,
}: {
  index: number;
  log: ExerciseLog;
  sessionId: string;
  unit: string;
  last?: LastSession;
  run: (fn: () => void) => void;
  onOpenSet: (t: SheetTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const done = log.sets.filter((s) => s.isCompleted);
  const exerciseTotal = totalEffectiveReps(log.sets);
  const working = done.filter((s) => !s.isWarmup).length;
  // A program day lays its planned sets out in advance. Fill those rows before
  // appending new ones, so the plan is used up rather than sitting empty beside
  // what actually happened.
  const nextPlanned = log.sets.find((s) => !s.isCompleted) ?? null;
  const planned = Math.max(log.plannedSets, 0);

  function openNew() {
    const previous = done[done.length - 1];
    onOpenSet({
      log,
      set: null,
      fillId: nextPlanned?.id ?? null,
      setNumber: done.length + 1,
      // Carried from the set just done, which is nearly always the same load.
      // Never from last week — that number is on the left to be read, not applied.
      weight: previous?.weight ?? 0,
      reps: previous?.reps ?? nextPlanned?.reps ?? 0,
      rir: null,
      isWarmup: false,
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="display tnum text-sm font-semibold text-ink-faint">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <h2 className="display truncate text-xl font-semibold">{log.name}</h2>
            <p className="text-[11px] text-ink-faint">
              {log.muscleGroup}
              {planned > 0 && ` · ${working}/${planned} planned`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <div className={`display tnum text-2xl font-semibold leading-none ${
              exerciseTotal ? "text-accent" : "text-ink-faint"
            }`}>
              {exerciseTotal}
            </div>
            <div className="eyebrow" style={{ fontSize: 9 }}>eff reps</div>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Exercise options"
            className="h-9 w-9 rounded-lg border border-line-2 bg-panel-2 text-ink-dim"
          >
            ⋯
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2">
        {/* ------------------------------------------------ last time */}
        <div className="border-r border-line px-3 pb-3">
          <p className="eyebrow mb-1.5">
            {last
              ? `Last · ${new Date(last.date).toLocaleDateString(undefined, {
                  day: "numeric", month: "short",
                })}`
              : "Last"}
          </p>
          {last ? (
            <ul className="tnum space-y-0.5">
              {last.sets.map((s) => (
                <li
                  key={s.setNumber}
                  className="flex items-baseline gap-2 border-b border-line/60 py-1 text-sm last:border-0"
                >
                  <span className="display w-4 shrink-0 text-xs font-semibold text-ink-faint">
                    {s.isWarmup ? "W" : s.setNumber}
                  </span>
                  <span className="text-ink-dim">
                    <span className="text-ink">{s.weight}</span>
                    <span className="text-ink-faint"> × </span>
                    <span className="text-ink">{s.reps}</span>
                    {s.rir !== null && (
                      <span className="text-ink-faint"> @{s.rir === MAX_RIR ? `${MAX_RIR}+` : s.rir}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-xs text-ink-faint">
              First time logging this one.
            </p>
          )}
        </div>

        {/* ---------------------------------------------------- today */}
        <div className="px-3 pb-3">
          <p className="eyebrow mb-1.5 text-accent">Today</p>
          {done.length > 0 && (
            <ul className="tnum mb-2 space-y-0.5">
              {done.map((s, i) => {
                const score = effectiveReps(s);
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => onOpenSet({
                        log, set: s, fillId: null,
                        setNumber: s.isWarmup ? i + 1 : done.filter((d, j) => !d.isWarmup && j <= i).length,
                        weight: s.weight, reps: s.reps, rir: s.rir, isWarmup: s.isWarmup,
                      })}
                      className="flex w-full items-baseline gap-1.5 border-b border-line/60 py-1
                                 text-left text-sm last:border-0 active:bg-panel-2"
                    >
                      <span className="display w-4 shrink-0 text-xs font-semibold text-ink-faint">
                        {s.isWarmup ? "W" : done.filter((d, j) => !d.isWarmup && j <= i).length}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-ink">{s.weight}</span>
                        <span className="text-ink-faint"> × </span>
                        <span className="text-ink">{s.reps}</span>
                        {s.rir !== null && (
                          <span className="text-ink-faint"> @{s.rir === MAX_RIR ? `${MAX_RIR}+` : s.rir}</span>
                        )}
                      </span>
                      <span className={`display shrink-0 text-base font-semibold ${
                        score ? "text-accent" : "text-ink-faint"
                      }`}>
                        {score === null ? "–" : score}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            onClick={openNew}
            className="display w-full rounded-xl border border-dashed border-accent/50 bg-accent-soft
                       py-2.5 text-base font-semibold text-accent active:bg-accent/20"
          >
            + Add set
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-2 border-t border-line px-3 py-3">
          <textarea
            defaultValue={log.notes}
            rows={2}
            placeholder="Notes for this lift"
            className={`${inputClass} py-2 text-sm`}
            onBlur={(e) => {
              const value = e.target.value;
              if (value !== log.notes) run(() => { void noteExercise(sessionId, log.id, value); });
            }}
          />
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (confirm(`Remove ${log.name} and its sets from this workout?`)) {
                run(() => { void dropExercise(sessionId, log.id); });
              }
            }}
          >
            Remove exercise
          </Button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- set sheet */

type SetValues = { weight: number; reps: number; rir: number | null; isWarmup: boolean };

/**
 * The one place a set is entered. Weight × reps × rating, on controls big
 * enough to hit with a chalked thumb, with the effective reps the set will
 * score shown before it is saved.
 */
function SetSheet({
  target, unit, trackRir, last, onSave, onDelete, onClose,
}: {
  target: SheetTarget;
  unit: string;
  trackRir: boolean;
  last?: LastSession;
  onSave: (v: SetValues) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [weight, setWeight] = useState(target.weight ? String(target.weight) : "");
  const [reps, setReps] = useState(target.reps ? String(target.reps) : "");
  const [rir, setRir] = useState<number | null>(target.rir);
  const [isWarmup, setIsWarmup] = useState(target.isWarmup);

  const weightNum = Number(weight) || 0;
  const repsNum = Number(reps) || 0;
  const score = effectiveReps({
    reps: repsNum, rir, isWarmup, isCompleted: true,
  });
  // What this set number looked like last week, shown so the sheet answers the
  // question without the user closing it to go and read the card.
  const lastMatch = last?.sets.find((s) => s.setNumber === target.setNumber);

  const step = (setter: (v: string) => void, current: number, by: number, min = 0) => () =>
    setter(String(Math.max(min, Math.round((current + by) * 100) / 100)));

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm">
      <button className="flex-1" aria-label="Close" onClick={onClose} />
      <div
        className="rise mx-auto w-full max-w-2xl rounded-t-3xl border-t border-line-2 bg-panel px-4 pt-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-accent">
              {isWarmup ? "Warm-up set" : `Set ${target.setNumber}`}
            </p>
            <h2 className="display truncate text-2xl font-semibold">{target.log.name}</h2>
            {lastMatch && (
              <p className="tnum mt-0.5 text-xs text-ink-faint">
                Last time: {lastMatch.weight} {unit} × {lastMatch.reps}
                {lastMatch.rir !== null && ` @${lastMatch.rir} RIR`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 shrink-0 rounded-lg border border-line-2 text-ink-dim"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <NumberField
            label={unit}
            value={weight}
            onChange={setWeight}
            onMinus={step(setWeight, weightNum, -2.5)}
            onPlus={step(setWeight, weightNum, 2.5)}
            decimal
          />
          <NumberField
            label="Reps"
            value={reps}
            onChange={setReps}
            onMinus={step(setReps, repsNum, -1)}
            onPlus={step(setReps, repsNum, 1)}
          />
        </div>

        {trackRir && !isWarmup && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">Reps in reserve</p>
              <p className="text-[11px] text-ink-faint">
                {score === null
                  ? "Rate it to score effective reps"
                  : `Scores ${score} effective rep${score === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="mt-1.5 flex gap-1">
              {Array.from({ length: MAX_RIR + 1 }, (_, n) => (
                <button
                  key={n}
                  onClick={() => setRir(rir === n ? null : n)}
                  className={`display tnum h-12 flex-1 rounded-xl border text-lg font-semibold ${
                    rir === n
                      ? "border-accent bg-accent text-black"
                      : "border-line-2 bg-panel-2 text-ink"
                  }`}
                >
                  {n === MAX_RIR ? `${n}+` : n}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
              Reps you could still have done. {EFFECTIVE_REP_THRESHOLD} − RIR counts, capped at
              the reps you did. Leave it blank and the set is logged but not scored.
            </p>
          </div>
        )}

        <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border
                          border-line-2 bg-panel-2 px-3 py-2.5">
          <span className="text-sm">
            Warm-up set
            <span className="block text-[11px] text-ink-faint">Never scored, never counted.</span>
          </span>
          <input
            type="checkbox"
            checked={isWarmup}
            onChange={(e) => setIsWarmup(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-[var(--accent)]"
          />
        </label>

        <div className="mt-4 flex gap-2">
          {target.set && (
            <Button
              variant="danger"
              className="px-4"
              onClick={() => {
                if (confirm("Delete this set?")) onDelete();
              }}
            >
              Delete
            </Button>
          )}
          <Button
            variant="primary"
            className="flex-1"
            disabled={repsNum <= 0}
            onClick={() => onSave({ weight: weightNum, reps: repsNum, rir, isWarmup })}
          >
            {target.set ? "Save set" : "Log set"}
          </Button>
        </div>
        {repsNum <= 0 && (
          <p className="mt-2 text-center text-[11px] text-ink-faint">Enter the reps to log it.</p>
        )}
      </div>
    </div>
  );
}

function NumberField({
  label, value, onChange, onMinus, onPlus, decimal = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onMinus: () => void;
  onPlus: () => void;
  decimal?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line-2 bg-panel-2 p-2">
      <p className="eyebrow text-center">{label}</p>
      <input
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="display tnum mt-1 w-full bg-transparent text-center text-4xl font-semibold
                   text-ink outline-none placeholder:text-ink-faint"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={onMinus}
          aria-label={`${label} down`}
          className="display h-11 flex-1 rounded-xl border border-line-2 bg-panel text-xl font-semibold text-ink-dim active:bg-panel-3"
        >
          −
        </button>
        <button
          onClick={onPlus}
          aria-label={`${label} up`}
          className="display h-11 flex-1 rounded-xl border border-line-2 bg-panel text-xl font-semibold text-ink-dim active:bg-panel-3"
        >
          +
        </button>
      </div>
    </div>
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
  const groups = [...new Set(library.map((e) => e.muscleGroup))];
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
