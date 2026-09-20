"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dropExercise, logSet, noteExercise, removeSet } from "@/app/actions";
import { RestTimer } from "@/components/rest-timer";
import { Button, inputClass } from "@/components/ui";
import {
  EFFECTIVE_REP_THRESHOLD, MAX_COUNTED_RIR, MAX_RIR, effectiveReps,
  isCountedSet, totalEffectiveReps,
} from "@/lib/effective-reps";
import { setVolume } from "@/lib/types";
import type { LastSession } from "@/lib/db";
import type { ExerciseLog, SetLog, Settings } from "@/lib/types";

type Props = {
  sessionId: string;
  dayName: string;
  log: ExerciseLog;
  index: number;
  total: number;
  settings: Settings;
  last?: LastSession;
};

/** The set the sheet is open on: an existing row to edit, or a new one. */
type SheetTarget = {
  set: SetLog | null;
  setNumber: number;
  /** The row to write into when one is already laid out by a program day. */
  fillId: string | null;
  weight: number;
  reps: number;
  rir: number | null;
  isWarmup: boolean;
};

/**
 * One lift, full screen.
 *
 * The session screen is a list of lifts; tracking happens here, where there is
 * room for the whole of last session beside the whole of today. Sets are still
 * entered through a sheet, never inline — a bigger screen is not a reason to
 * put number boxes back in the card.
 */
export function ExerciseScreen({
  sessionId, dayName, log, index, total, settings, last,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [menu, setMenu] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [restKey, setRestKey] = useState(0);
  const unit = settings.weightUnit;
  const run = (fn: () => void) => startTransition(fn);

  const done = log.sets.filter((s) => s.isCompleted);
  const exerciseTotal = totalEffectiveReps(log.sets);
  const working = done.filter(isCountedSet).length;
  const volume = log.sets.reduce((sum, s) => sum + setVolume(s), 0);
  // A program day lays its planned sets out in advance. Fill those rows before
  // appending new ones, so the plan is used up rather than sitting empty beside
  // what actually happened.
  const nextPlanned = log.sets.find((s) => !s.isCompleted) ?? null;
  const planned = Math.max(log.plannedSets, 0);

  /** Working-set number of the row at position `i` in `done`. */
  const numberAt = (i: number) => done.filter((d, j) => !d.isWarmup && j <= i).length;

  function openNew() {
    const previous = done[done.length - 1];
    setSheet({
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
    <>
      {/* Sticky header. The back link is to the session, not to history — this
          screen is one step inside a workout that is still running. */}
      <div
        className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/log/${sessionId}`} className="eyebrow text-accent">
                ‹ {dayName}
              </Link>
              <h1 className="display mt-0.5 truncate text-3xl font-semibold">{log.name}</h1>
              <p className="tnum mt-0.5 text-xs text-ink-faint">
                {log.muscleGroup} · lift {index + 1} of {total}
                {planned > 0 && ` · ${working}/${planned} planned`}
                {volume > 0 && ` · ${Math.round(volume).toLocaleString()} ${unit}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="text-right">
                <div className={`display tnum text-4xl font-semibold leading-none ${
                  exerciseTotal ? "text-accent" : "text-ink-faint"
                }`}>
                  {exerciseTotal}
                </div>
                <div className="eyebrow" style={{ fontSize: 9 }}>eff reps</div>
              </div>
              <button
                onClick={() => setMenu((v) => !v)}
                aria-label="Exercise options"
                aria-expanded={menu}
                className="h-9 w-9 rounded-lg border border-line-2 bg-panel-2 text-ink-dim"
              >
                ⋯
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pt-4" style={{ paddingBottom: "8.5rem" }}>
        {menu && (
          <div className="mb-3 space-y-2 rounded-2xl border border-line bg-panel p-3">
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
              disabled={removing}
              onClick={() => {
                if (!confirm(`Remove ${log.name} and its sets from this workout?`)) return;
                setRemoving(true);
                // The write finishes before the navigation, so the list that
                // comes back has already lost the row — and `replace`, not
                // `push`, because Back would otherwise land on this page after
                // its own lift is gone, on a 404 with the nav bar hidden.
                void dropExercise(sessionId, log.id)
                  .then(() => router.replace(`/log/${sessionId}`))
                  .catch(() => setRemoving(false));
              }}
            >
              {removing ? "Removing…" : "Remove exercise"}
            </Button>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="grid grid-cols-2">
            {/* ---------------------------------------------- last time */}
            <div className="border-r border-line px-3 py-3">
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
                      className="flex items-baseline gap-2 border-b border-line/60 py-1.5 text-sm last:border-0"
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
                <p className="py-2 text-xs text-ink-faint">First time logging this one.</p>
              )}
            </div>

            {/* -------------------------------------------------- today */}
            <div className="px-3 py-3">
              <p className="eyebrow mb-1.5 text-accent">Today</p>
              {done.length > 0 ? (
                <ul className="tnum space-y-0.5">
                  {done.map((s, i) => {
                    const score = effectiveReps(s);
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => setSheet({
                            set: s, fillId: null,
                            setNumber: s.isWarmup ? i + 1 : numberAt(i),
                            weight: s.weight, reps: s.reps, rir: s.rir, isWarmup: s.isWarmup,
                          })}
                          className="flex w-full items-baseline gap-1.5 border-b border-line/60 py-1.5
                                     text-left text-sm last:border-0 active:bg-panel-2"
                        >
                          <span className="display w-4 shrink-0 text-xs font-semibold text-ink-faint">
                            {s.isWarmup ? "W" : numberAt(i)}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            <span className="text-ink">{s.weight}</span>
                            <span className="text-ink-faint"> × </span>
                            <span className="text-ink">{s.reps}</span>
                            {s.rir !== null && (
                              <span className="text-ink-faint"> @{s.rir === MAX_RIR ? `${MAX_RIR}+` : s.rir}</span>
                            )}
                          </span>
                          {/* Null is not zero: an unrated set is unknown. */}
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
              ) : (
                <p className="py-2 text-xs text-ink-faint">
                  {planned > 0 ? `${planned} sets planned.` : "Nothing yet."}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-line p-3">
            <button
              onClick={openNew}
              className="display w-full rounded-xl border border-dashed border-accent/50 bg-accent-soft
                         py-3.5 text-lg font-semibold text-accent active:bg-accent/20"
            >
              + Add set
            </button>
          </div>
        </section>

        <Link
          href={`/log/${sessionId}`}
          className="mt-3 block rounded-xl border border-line bg-panel px-4 py-3 text-center
                     text-sm text-ink-dim active:bg-panel-2"
        >
          Back to the workout
        </Link>
      </main>

      {/* The timer floats over the page so it is readable between sets without
          scrolling. It starts itself when a set is saved, and it keeps running
          across the walk back to the exercise list. */}
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
          name={log.name}
          unit={unit}
          trackRir={settings.trackRir}
          last={last}
          onClose={() => setSheet(null)}
          onDelete={() => {
            const id = sheet.set?.id;
            setSheet(null);
            if (id) run(() => { void removeSet(sessionId, id); });
          }}
          onSave={(values) => {
            const isNew = !sheet.set;
            setSheet(null);
            run(() => { void logSet(sessionId, log.id, sheet.set?.id ?? sheet.fillId, values); });
            // Rest starts when a set is recorded, not when one is corrected.
            // A set rated too easy to count is a warm-up; no rest is owed for it.
            if (isNew && isCountedSet({ ...values, isCompleted: true })) setRestKey((k) => k + 1);
          }}
        />
      )}

      {pending && <span className="sr-only" role="status">Saving</span>}
    </>
  );
}

/**
 * How much of the screen the on-screen keyboard is covering.
 *
 * A `position: fixed` element is laid out against the *layout* viewport, which
 * iOS Safari does not shrink when the keyboard comes up — so a sheet pinned to
 * the bottom ends up underneath it, which is exactly what happened to the set
 * sheet. The visual viewport is the part still showing; the difference between
 * the two is the keyboard. Zero on a desktop and on any browser without the
 * API, where the sheet simply sits on the bottom as before.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // offsetTop matters: iOS scrolls the visual viewport up as well as
      // shrinking it, and both together say where the keyboard starts.
      const covered = window.innerHeight - (vv.height + vv.offsetTop);
      setInset(Math.max(0, Math.round(covered)));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}

/* ------------------------------------------------------------- set sheet */

type SetValues = { weight: number; reps: number; rir: number | null; isWarmup: boolean };

/**
 * The one place a set is entered. Weight × reps × rating, on controls big
 * enough to hit with a chalked thumb, with the effective reps the set will
 * score shown before it is saved.
 */
function SetSheet({
  target, name, unit, trackRir, last, onSave, onDelete, onClose,
}: {
  target: SheetTarget;
  name: string;
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
  // Not editable any more — the checkbox is gone and a rating over
  // MAX_COUNTED_RIR does that job. Old rows keep the flag they were saved with.
  const isWarmup = target.isWarmup;

  const weightNum = Number(weight) || 0;
  const repsNum = Number(reps) || 0;
  const score = effectiveReps({ reps: repsNum, rir, isWarmup, isCompleted: true });
  // What this set number looked like last week, shown so the sheet answers the
  // question without the user closing it to go and read the card.
  const lastMatch = last?.sets.find((s) => s.setNumber === target.setNumber);

  const keyboard = useKeyboardInset();

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm"
      style={{ bottom: keyboard }}
    >
      <button className="min-h-0 flex-1" aria-label="Close" onClick={onClose} />
      <div className="rise mx-auto flex max-h-full w-full max-w-2xl flex-col rounded-t-3xl
                      border-t border-line-2 bg-panel">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow text-accent">
                {isWarmup ? "Warm-up set" : `Set ${target.setNumber}`}
              </p>
              <h2 className="display truncate text-2xl font-semibold">{name}</h2>
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

          {/* Weight × reps, typed. Nothing between the two boxes but the ×. */}
          <div className="mt-4 flex items-end gap-2">
            <NumberField label={unit} value={weight} onChange={setWeight} decimal autoFocus />
            <span className="display pb-3 text-2xl font-semibold text-ink-faint">×</span>
            <NumberField label="Reps" value={reps} onChange={setReps} />
          </div>
          {repsNum <= 0 && (
            <p className="mt-1.5 text-center text-[11px] text-ink-faint">
              Enter the reps to log this set.
            </p>
          )}

          {trackRir && (
            <div className="mb-4 mt-4">
              <div className="flex items-baseline justify-between">
                <p className="eyebrow">Reps in reserve</p>
                <p className="text-[11px] text-ink-faint">
                  {rir !== null && rir > MAX_COUNTED_RIR
                    ? "Too easy to count"
                    : score === null
                      ? "Rate it to score effective reps"
                      : `Scores ${score} effective rep${score === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="mt-1.5 flex gap-1">
                {Array.from({ length: MAX_RIR + 1 }, (_, n) => (
                  <button
                    key={n}
                    // Keeps focus in the number field, so the keyboard stays up and
                    // the sheet does not drop back down and bounce on every tap.
                    onMouseDown={(e) => e.preventDefault()}
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
                the reps you did. Over {MAX_COUNTED_RIR} the set does not count at all — that is
                a warm-up. Leave it blank and the set is logged but not scored.
              </p>
            </div>
          )}
        </div>

        {/* Always reachable, whatever the keyboard is covering. */}
        <div
          className="flex gap-2 border-t border-line px-4 pt-3"
          style={{
            paddingBottom: keyboard > 0
              ? "0.75rem"
              : "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {target.set && (
            <Button
              variant="danger"
              className="px-4"
              onClick={() => { if (confirm("Delete this set?")) onDelete(); }}
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
      </div>
    </div>
  );
}

function NumberField({
  label, value, onChange, decimal = false, autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex-1">
      <span className="eyebrow block text-center">{label}</span>
      <input
        autoFocus={autoFocus}
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        aria-label={label}
        className="display tnum mt-1 h-16 w-full rounded-2xl border border-line-2 bg-panel-2
                   text-center text-4xl font-semibold text-ink outline-none
                   placeholder:text-ink-faint focus:border-accent focus:bg-panel-3"
      />
    </label>
  );
}
