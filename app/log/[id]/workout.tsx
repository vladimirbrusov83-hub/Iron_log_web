"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  addExercise, appendSet, discardWorkout, dropExercise, finishWorkout,
  noteExercise, noteSession, removeSet, saveSet,
} from "@/app/actions";
import { RestTimer } from "@/components/rest-timer";
import { BAND_COLOR, Button, inputClass } from "@/components/ui";
import {
  EFFECTIVE_REP_THRESHOLD, MAX_RIR, effectiveReps, effectiveRepsByMuscle,
  effectiveRepsCoverage, totalEffectiveReps,
} from "@/lib/effective-reps";
import { SESSION_ER_HIGH, SESSION_ER_LOW, sessionErBand } from "@/lib/targets";
import { setVolume } from "@/lib/types";
import type { Exercise, ExerciseLog, Session, SetLog, Settings } from "@/lib/types";

type Last = { date: string; weight: number; reps: number; rir: number | null };

type Props = {
  session: Session;
  settings: Settings;
  library: Exercise[];
  lastTime: Record<string, Last>;
};

export function Workout({ session, settings, library, lastTime }: Props) {
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
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
          screen while the set list scrolls under it. The coverage line is not
          decoration: without it a low total is ambiguous between an easy session
          and an unrated one. */}
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
              trackRir={settings.trackRir}
              last={lastTime[log.name.toLowerCase()]}
              pending={pending}
              run={run}
              onTick={() => setRestKey((k) => k + 1)}
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
          scrolling back up. It starts itself when a set is ticked. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 px-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto max-w-2xl shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)]">
          <RestTimer defaultSeconds={settings.defaultRestSeconds} autoStartKey={restKey} />
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

/** Minutes since the session started, refreshed once a minute. */
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

function ExerciseCard({
  index, log, sessionId, unit, trackRir, last, pending, run, onTick,
}: {
  index: number;
  log: ExerciseLog;
  sessionId: string;
  unit: string;
  trackRir: boolean;
  last?: Last;
  pending: boolean;
  run: (fn: () => void) => void;
  onTick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const exerciseTotal = totalEffectiveReps(log.sets);
  const done = log.sets.filter((s) => s.isCompleted && !s.isWarmup).length;
  const working = log.sets.filter((s) => !s.isWarmup).length;
  const emptySets = log.sets.filter((s) => !s.isWarmup && !s.isCompleted && s.weight === 0);
  const allDone = working > 0 && done === working;

  return (
    <section className={`rounded-2xl border bg-panel ${allDone ? "border-good/30" : "border-line"}`}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="display tnum text-sm font-semibold text-ink-faint">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="display truncate text-xl font-semibold">{log.name}</h2>
          </div>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {log.muscleGroup}
            {last && (
              <>
                {" · last "}
                <span className="tnum text-ink-dim">
                  {last.weight}{unit} × {last.reps}{last.rir !== null ? ` @${last.rir}` : ""}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className={`display tnum text-2xl font-semibold ${exerciseTotal ? "text-accent" : "text-ink-faint"}`}>
            {exerciseTotal}
          </div>
          <div className="eyebrow" style={{ fontSize: 9 }}>eff reps</div>
        </div>
      </div>

      <div className="mt-2 px-2 pb-1">
        <div className="grid grid-cols-[1.75rem_1fr_1fr_3.25rem_1.75rem_2.5rem] gap-1.5 px-1 pb-1">
          <span className="eyebrow" style={{ fontSize: 9 }}>Set</span>
          <span className="eyebrow text-center" style={{ fontSize: 9 }}>{unit}</span>
          <span className="eyebrow text-center" style={{ fontSize: 9 }}>Reps</span>
          <span className="eyebrow text-center" style={{ fontSize: 9 }}>{trackRir ? "RIR" : ""}</span>
          <span className="eyebrow text-center" style={{ fontSize: 9 }}>ER</span>
          <span />
        </div>
        {log.sets.map((set) => (
          <SetRow
            key={set.id}
            set={set}
            sessionId={sessionId}
            trackRir={trackRir}
            pending={pending}
            run={run}
            onTick={onTick}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 pb-3 pt-1">
        <Button
          className="flex-1"
          disabled={pending}
          onClick={() => run(() => { void appendSet(sessionId, log.id); })}
        >
          + Set
        </Button>
        {last && emptySets.length > 0 && (
          // Fills what you lifted last time into the empty rows. Your own
          // history, one tap — not a suggestion.
          <Button
            className="flex-1 text-xs"
            disabled={pending}
            onClick={() => run(() => {
              for (const s of emptySets) void saveSet(sessionId, s.id, { weight: last.weight });
            })}
          >
            Use last {last.weight}{unit}
          </Button>
        )}
        <span className="tnum px-1 text-xs text-ink-faint">{done}/{working}</span>
        <Button className="px-3" onClick={() => setOpen((v) => !v)} aria-label="Exercise options">
          ⋯
        </Button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-line px-4 py-3">
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

/* ------------------------------------------------------------------- row */

const cell =
  "tnum h-11 w-full rounded-lg border border-line-2 bg-panel-2 text-center text-base " +
  "outline-none focus:border-accent focus:bg-panel-3";

function SetRow({
  set, sessionId, trackRir, pending, run, onTick,
}: {
  set: SetLog; sessionId: string; trackRir: boolean;
  pending: boolean; run: (fn: () => void) => void; onTick: () => void;
}) {
  // Mirrored locally so typing stays responsive while the server action is in
  // flight; the server value wins again on the next render after it lands.
  const [weight, setWeight] = useState(String(set.weight || ""));
  const [reps, setReps] = useState(String(set.reps || ""));
  const [menu, setMenu] = useState(false);
  const [rirOpen, setRirOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const repsRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setWeight(String(set.weight || "")); }, [set.weight]);
  useEffect(() => { setReps(String(set.reps || "")); }, [set.reps]);

  const score = effectiveReps({ ...set, reps: Number(reps) || 0 });

  function patch(next: Parameters<typeof saveSet>[2]) {
    run(() => { void saveSet(sessionId, set.id, next); });
  }

  /** Marks the set done and carries whatever is typed in the boxes with it, so a
   *  set can be logged in one tap without blurring each box first. */
  function complete(extra: Parameters<typeof saveSet>[2] = {}) {
    patch({
      ...extra,
      isCompleted: true,
      weight: Number(weight) || 0,
      reps: Number(reps) || 0,
    });
    // Only on the transition, so re-rating a finished set does not restart rest.
    if (!set.isCompleted) {
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
      if (!set.isWarmup) onTick();
    }
  }

  function tick() {
    if (set.isCompleted) {
      patch({ isCompleted: false, weight: Number(weight) || 0, reps: Number(reps) || 0 });
      return;
    }
    complete();
  }

  /** Rating a set is the user saying they did it, so the rating ticks it off and
   *  scores it in the same write — one tap, not two. Effective reps appear the
   *  moment the RIR lands rather than waiting for a separate ✓. */
  function rate(rir: number) {
    setRirOpen(false);
    complete({ rir });
  }

  const rowTone = set.isCompleted
    ? "bg-good/[0.06]"
    : set.isWarmup ? "opacity-70" : "";

  return (
    <>
      <div
        className={`grid grid-cols-[1.75rem_1fr_1fr_3.25rem_1.75rem_2.5rem] items-center gap-1.5
                    rounded-xl px-1 py-1 ${rowTone}`}
      >
        {/* The set number doubles as this row's menu button. At 375px a seventh
            column would push the number boxes under a comfortable thumb. */}
        <button
          onClick={() => setMenu((v) => !v)}
          aria-label={`Options for set ${set.setNumber}`}
          className={`display tnum h-11 rounded-lg text-base font-semibold ${
            menu ? "bg-panel-3 text-ink" : set.isWarmup ? "text-ink-faint" : "text-ink-dim"
          }`}
        >
          {set.isWarmup ? "W" : set.setNumber}
        </button>

        <input
          inputMode="decimal"
          enterKeyHint="next"
          value={weight}
          placeholder="0"
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() => { if (Number(weight) !== set.weight) patch({ weight: Number(weight) || 0 }); }}
          onKeyDown={(e) => { if (e.key === "Enter") repsRef.current?.focus(); }}
          className={cell}
        />

        <input
          ref={repsRef}
          inputMode="numeric"
          enterKeyHint="done"
          value={reps}
          placeholder="0"
          onChange={(e) => setReps(e.target.value)}
          onBlur={() => { if (Number(reps) !== set.reps) patch({ reps: Number(reps) || 0 }); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className={cell}
        />

        {/* One tap opens a strip of chips; RIR has seven states including "not
            rated" and each should be one more tap away. Warmups are never
            scored, so theirs is disabled. */}
        {trackRir ? (
          <button
            onClick={() => setRirOpen((v) => !v)}
            disabled={set.isWarmup}
            aria-label="Reps in reserve"
            className={`display tnum h-11 w-full rounded-lg border text-base font-semibold
                        disabled:opacity-30 ${
              rirOpen ? "border-accent bg-panel-3 text-accent"
              : set.rir === null ? "border-dashed border-line-2 bg-panel-2 text-ink-faint"
              : "border-line-2 bg-panel-2 text-ink"
            }`}
          >
            {set.rir === null ? "–" : set.rir === MAX_RIR ? `${MAX_RIR}+` : set.rir}
          </button>
        ) : (
          <span />
        )}

        <span
          className={`display tnum text-center text-lg font-semibold ${score ? "text-accent" : "text-ink-faint"}`}
          title="Effective reps for this set"
        >
          {score === null ? "–" : score}
        </span>

        <button
          onClick={tick}
          disabled={pending}
          aria-label={set.isCompleted ? "Mark set not done" : "Mark set done"}
          className={`h-11 w-full rounded-lg border text-base transition-colors ${flash ? "ticked" : ""} ${
            set.isCompleted
              ? "border-good bg-good/20 text-good"
              : "border-line-2 bg-panel-2 text-ink-faint active:bg-panel-3"
          }`}
        >
          <svg className="mx-auto" width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        </button>
      </div>

      {rirOpen && trackRir && !set.isWarmup && (
        <div className="mb-1.5 mt-0.5 px-1">
          <div className="flex items-center gap-1">
            <span className="eyebrow mr-1 shrink-0" style={{ fontSize: 9 }}>RIR</span>
            {Array.from({ length: MAX_RIR + 1 }, (_, n) => (
              <button
                key={n}
                onClick={() => rate(n)}
                className={`display tnum h-10 flex-1 rounded-lg border text-base font-semibold ${
                  set.rir === n
                    ? "border-accent bg-accent text-black"
                    : "border-line-2 bg-panel-2 text-ink"
                }`}
              >
                {n === MAX_RIR ? `${n}+` : n}
              </button>
            ))}
            {/* Clears the rating only. The set stays logged — untick it with ✓. */}
            <button
              onClick={() => { patch({ rir: null }); setRirOpen(false); }}
              className="h-10 w-9 shrink-0 rounded-lg border border-line text-xs text-ink-faint"
              aria-label="Clear rating"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-[10px] text-ink-faint">
            {set.isCompleted
              ? `Scores ${EFFECTIVE_REP_THRESHOLD} − RIR effective reps, capped at the reps done.`
              : "Rating logs the set and scores it."}
          </p>
        </div>
      )}

      {menu && (
        <div className="mb-1.5 mt-0.5 flex gap-2 px-1">
          <Button
            className="flex-1 text-xs"
            onClick={() => { patch({ isWarmup: !set.isWarmup }); setMenu(false); }}
          >
            {set.isWarmup ? "Make working set" : "Mark as warmup"}
          </Button>
          <Button
            variant="danger"
            className="flex-1 text-xs"
            onClick={() => { setMenu(false); run(() => { void removeSet(sessionId, set.id); }); }}
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
