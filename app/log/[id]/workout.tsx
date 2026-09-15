"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  addExercise, appendSet, discardWorkout, dropExercise, finishWorkout,
  noteExercise, noteSession, removeSet, saveSet,
} from "@/app/actions";
import { RestTimer } from "@/components/rest-timer";
import { Button, Page, inputClass } from "@/components/ui";
import {
  MAX_RIR, effectiveReps, effectiveRepsCoverage, totalEffectiveReps,
} from "@/lib/effective-reps";
import { setVolume } from "@/lib/types";
import type { Exercise, ExerciseLog, Session, SetLog, Settings } from "@/lib/types";

type Props = {
  session: Session;
  settings: Settings;
  library: Exercise[];
  lastTime: Record<string, { date: string; weight: number; reps: number; rir: number | null }>;
};

export function Workout({ session, settings, library, lastTime }: Props) {
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
  const unit = settings.weightUnit;

  const allSets = session.exercises.flatMap((e) => e.sets);
  const dayTotal = totalEffectiveReps(allSets);
  const coverage = effectiveRepsCoverage(allSets);
  const volume = allSets.reduce((sum, s) => sum + setVolume(s), 0);
  const elapsed = Math.max(0, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000));

  return (
    <Page>
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-accent">
          {session.programName || "Freestyle"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{session.dayName}</h1>
        <p className="mt-0.5 text-sm text-ink-dim tnum">
          {elapsed} min · {Math.round(volume).toLocaleString()} {unit} volume
        </p>
      </header>

      {/* The one number this rebuild exists for, kept at the top of the screen
          where it can be read between sets. The coverage line under it is not
          decoration: without it a low total is ambiguous between an easy session
          and an unrated one. */}
      <div className="mb-4 rounded-xl border border-accent-dim bg-accent/10 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-wide text-accent">
            Effective reps
          </span>
          <span className="tnum text-3xl font-semibold text-accent">{dayTotal}</span>
        </div>
        <p className="mt-1 text-[11px] text-ink-dim">
          {coverage.working === 0
            ? "Tick a set off and rate it to start counting."
            : `${coverage.scored} of ${coverage.working} working sets rated` +
              (coverage.scored < coverage.working ? " — unrated sets count nothing" : "")}
        </p>
      </div>

      <div className="mb-4">
        <RestTimer defaultSeconds={settings.defaultRestSeconds} />
      </div>

      <div className="space-y-3">
        {session.exercises.map((log) => (
          <ExerciseCard
            key={log.id}
            log={log}
            sessionId={session.id}
            unit={unit}
            trackRir={settings.trackRir}
            last={lastTime[log.name.toLowerCase()]}
            pending={pending}
            run={(fn) => startTransition(fn)}
          />
        ))}
      </div>

      {session.exercises.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">
          Nothing logged yet. Add a lift to begin.
        </p>
      )}

      <div className="mt-4 space-y-3">
        <Button className="w-full" onClick={() => setPicking(true)}>+ Add exercise</Button>

        <textarea
          defaultValue={session.notes}
          placeholder="Session notes"
          rows={2}
          className={`${inputClass} py-2`}
          onBlur={(e) => {
            const value = e.target.value;
            if (value !== session.notes) {
              startTransition(() => { void noteSession(session.id, value); });
            }
          }}
        />

        <Button
          variant="primary"
          className="w-full"
          disabled={pending}
          onClick={() => startTransition(() => { void finishWorkout(session.id); })}
        >
          Finish workout
        </Button>

        {/* Destructive and permanent, so it asks first and never sits next to
            "Finish" as an equal-looking button. */}
        <Button
          variant="danger"
          className="w-full"
          disabled={pending}
          onClick={() => {
            if (confirm("Discard this workout? Everything logged in it is deleted.")) {
              startTransition(() => { void discardWorkout(session.id); });
            }
          }}
        >
          Discard workout
        </Button>
      </div>

      {picking && (
        <ExercisePicker
          library={library}
          onClose={() => setPicking(false)}
          onPick={(exerciseId, name, muscleGroup) => {
            setPicking(false);
            startTransition(() => { void addExercise(session.id, exerciseId, name, muscleGroup); });
          }}
        />
      )}
    </Page>
  );
}

/* ------------------------------------------------------------------ card */

function ExerciseCard({
  log, sessionId, unit, trackRir, last, pending, run,
}: {
  log: ExerciseLog;
  sessionId: string;
  unit: string;
  trackRir: boolean;
  last?: { date: string; weight: number; reps: number; rir: number | null };
  pending: boolean;
  run: (fn: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const exerciseTotal = totalEffectiveReps(log.sets);
  const done = log.sets.filter((s) => s.isCompleted && !s.isWarmup).length;
  const working = log.sets.filter((s) => !s.isWarmup).length;

  return (
    <section className="rounded-xl border border-line bg-panel">
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium">{log.name}</h2>
          <p className="text-[11px] text-ink-faint">
            {log.muscleGroup}
            {last && ` · last: ${last.weight}${unit} × ${last.reps}` +
              (last.rir !== null ? ` @${last.rir} RIR` : "")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="tnum text-lg font-semibold text-accent">{exerciseTotal}</div>
          <div className="text-[10px] uppercase tracking-wide text-ink-faint">eff reps</div>
        </div>
      </div>

      <div className="mt-2 px-2 pb-1">
        <div className="grid grid-cols-[1.75rem_1fr_1fr_3.5rem_1.75rem_2.25rem] gap-1 px-2 pb-1
                        text-[10px] uppercase tracking-wide text-ink-faint">
          <span>#</span><span>{unit}</span><span>Reps</span>
          <span>{trackRir ? "RIR" : ""}</span><span className="text-center">ER</span><span />
        </div>
        {log.sets.map((set) => (
          <SetRow
            key={set.id}
            set={set}
            sessionId={sessionId}
            trackRir={trackRir}
            pending={pending}
            run={run}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 pb-3 pt-1">
        <Button
          className="flex-1"
          disabled={pending}
          onClick={() => run(() => { void appendSet(sessionId, log.id); })}
        >
          + Set
        </Button>
        <span className="tnum text-xs text-ink-faint">{done}/{working}</span>
        <Button
          className="px-3"
          onClick={() => setOpen((v) => !v)}
          aria-label="Exercise options"
        >
          ⋯
        </Button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-line px-4 py-3">
          <textarea
            defaultValue={log.notes}
            rows={2}
            placeholder="Notes for this lift"
            className={`${inputClass} py-2`}
            onBlur={(e) => {
              const value = e.target.value;
              if (value !== log.notes) {
                run(() => { void noteExercise(sessionId, log.id, value); });
              }
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

/* ------------------------------------------------------------------- row */

function SetRow({
  set, sessionId, trackRir, pending, run,
}: {
  set: SetLog; sessionId: string; trackRir: boolean;
  pending: boolean; run: (fn: () => void) => void;
}) {
  // Mirrored locally so typing stays responsive while the server action is in
  // flight; the server value wins again on the next render after it lands.
  const [weight, setWeight] = useState(String(set.weight || ""));
  const [reps, setReps] = useState(String(set.reps || ""));
  const [menu, setMenu] = useState(false);

  const score = effectiveReps({ ...set, reps: Number(reps) || 0 });

  function patch(next: Parameters<typeof saveSet>[2]) {
    run(() => { void saveSet(sessionId, set.id, next); });
  }

  return (
    <>
      <div
        className={`grid grid-cols-[1.75rem_1fr_1fr_3.5rem_1.75rem_2.25rem] items-center gap-1
                    rounded-lg px-2 py-1 ${set.isCompleted ? "bg-panel-2/60" : ""}`}
      >
        {/* The set number doubles as this row's menu button. At 375px a seventh
            column would push the number boxes under a comfortable thumb. */}
        <button
          onClick={() => setMenu((v) => !v)}
          aria-label={`Options for set ${set.setNumber}`}
          className={`tnum h-9 rounded-md text-xs ${
            menu ? "bg-panel-2 text-ink" : set.isWarmup ? "text-ink-faint" : "text-ink-dim"
          }`}
        >
          {set.isWarmup ? "W" : set.setNumber}
        </button>

        <input
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() => patch({ weight: Number(weight) || 0 })}
          className="tnum h-9 w-full rounded-md border border-line bg-panel-2 px-1 text-center
                     outline-none focus:border-accent"
        />

        <input
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={() => patch({ reps: Number(reps) || 0 })}
          className="tnum h-9 w-full rounded-md border border-line bg-panel-2 px-1 text-center
                     outline-none focus:border-accent"
        />

        {/* A select rather than a stepper: RIR has seven states including "not
            rated", and one tap should reach any of them mid-set. Warmups are
            disabled because they are never scored. */}
        {trackRir ? (
          <select
            value={set.rir === null ? "" : String(set.rir)}
            onChange={(e) => patch({ rir: e.target.value === "" ? null : Number(e.target.value) })}
            disabled={set.isWarmup}
            className="tnum h-9 w-full rounded-md border border-line bg-panel-2 text-center
                       outline-none focus:border-accent disabled:opacity-30"
          >
            <option value="">–</option>
            {Array.from({ length: MAX_RIR + 1 }, (_, n) => (
              <option key={n} value={n}>{n === MAX_RIR ? `${n}+` : n}</option>
            ))}
          </select>
        ) : (
          <span />
        )}

        <span
          className={`tnum text-center text-sm ${score ? "text-accent" : "text-ink-faint"}`}
          title="Effective reps for this set"
        >
          {score === null ? "–" : score}
        </span>

        <button
          onClick={() => patch({ isCompleted: !set.isCompleted })}
          disabled={pending}
          aria-label={set.isCompleted ? "Mark set not done" : "Mark set done"}
          className={`h-9 w-full rounded-md border text-sm ${
            set.isCompleted
              ? "border-good bg-good/15 text-good"
              : "border-line bg-panel-2 text-ink-faint"
          }`}
        >
          ✓
        </button>
      </div>

      {menu && (
        <div className="mb-1 flex gap-2 px-2">
          <Button
            className="flex-1 text-xs"
            onClick={() => { patch({ isWarmup: !set.isWarmup }); setMenu(false); }}
          >
            {set.isWarmup ? "Make working set" : "Mark as warmup"}
          </Button>
          <Button
            variant="danger"
            className="flex-1 text-xs"
            onClick={() => {
              setMenu(false);
              run(() => { void removeSet(sessionId, set.id); });
            }}
          >
            Delete set
          </Button>
        </div>
      )}
    </>
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
  const q = query.trim().toLowerCase();
  const matches = q === ""
    ? library
    : library.filter((e) => e.name.toLowerCase().includes(q));
  const exact = library.some((e) => e.name.toLowerCase() === q);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur"
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

        <div className="mt-3 flex-1 overflow-y-auto pb-6">
          {q !== "" && !exact && (
            <button
              onClick={() => onPick(null, query.trim(), "Other")}
              className="mb-2 w-full rounded-lg border border-dashed border-accent-dim px-3 py-3
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
                  className="flex w-full items-center justify-between rounded-lg border
                             border-line bg-panel px-3 py-3 text-left"
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
