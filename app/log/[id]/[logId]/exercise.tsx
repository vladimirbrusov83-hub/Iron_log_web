"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  logSet, markExerciseDone, noteExercise, removeSet,
} from "@/app/actions";
import { RestTimer } from "@/components/rest-timer";
import { WorkoutClock } from "@/components/workout-clock";
import { BAND_COLOR, BackLink, Button, SessionErBar, inputClass } from "@/components/ui";
import {
  EFFECTIVE_REP_THRESHOLD, MAX_COUNTED_RIR, MAX_RIR, effectiveReps,
  isCountedSet, totalEffectiveReps, type MuscleSlice,
} from "@/lib/effective-reps";
import { SESSION_ER_HIGH, SESSION_ER_LOW, sessionErBand } from "@/lib/targets";
import { setVolume } from "@/lib/types";
import type { ExerciseNote, LastSession, LiftSessionOption } from "@/lib/db";
import type { ExerciseLog, SetLog, Settings } from "@/lib/types";

type PreviousWorkout = { dayName: string; startedAt: string; byMuscle: MuscleSlice[] };

type Props = {
  sessionId: string;
  dayName: string;
  startedAt: string;
  log: ExerciseLog;
  index: number;
  total: number;
  settings: Settings;
  last?: LastSession;
  /** Set when the left column shows a workout picked from the lift's history
   *  (`?from=`), null when it is simply the most recent one. */
  lastId: string | null;
  liftSessions: LiftSessionOption[];
  /** The lift's library note, or null when it is not in the library. Shown on
   *  the left only when last session left no note of its own. */
  note: ExerciseNote | null;
  /** The whole workout so far, per muscle — what the ⋯ panel shows. */
  byMuscle: MuscleSlice[];
  /** Another lift in this workout has logged sets for the same muscle. The
   *  header then shows the muscle's total, and this lift's own moves under Today. */
  muscleShared: boolean;
  /** The workout before this one (same program day if possible), per muscle —
   *  the ⋯ panel's "Last time" tab. Null when there is none. */
  previous: PreviousWorkout | null;
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
  restPauseReps: number;
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
  sessionId, dayName, startedAt, log, index, total, settings, last, lastId, liftSessions,
  note, byMuscle, muscleShared, previous,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [menu, setMenu] = useState(false);
  const [choosingLast, setChoosingLast] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [restKey, setRestKey] = useState(0);
  const unit = settings.weightUnit;
  const run = (fn: () => void) => startTransition(fn);

  const done = log.sets.filter((s) => s.isCompleted);
  const exerciseTotal = totalEffectiveReps(log.sets);
  const working = done.filter(isCountedSet).length;
  const muscleTotal = byMuscle.find((m) => m.muscleGroup === log.muscleGroup)?.effectiveReps ?? 0;
  const headerTotal = muscleTotal;
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
      // Rest-pause is never carried over: a sticky switch would quietly log the
      // next straight set as rest-pause. It is switched on per set.
      restPauseReps: 0,
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
          <div className="mb-1 flex items-center justify-between gap-3">
            <BackLink href={`/log/${sessionId}`} label={dayName} className="min-w-0" />
            <WorkoutClock startedAt={startedAt} />
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="display mt-0.5 truncate text-3xl font-semibold">{log.name}</h1>
              <p className="tnum mt-0.5 text-xs text-ink-faint">
                {log.muscleGroup} · lift {index + 1} of {total}
                {planned > 0 && ` · ${working}/${planned} planned`}
                {volume > 0 && ` · ${Math.round(volume).toLocaleString("en-US")} ${unit}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="text-right">
                <div className={`display tnum text-4xl font-semibold leading-none ${
                  headerTotal ? "text-accent" : "text-ink-faint"
                }`}>
                  {headerTotal}
                </div>
                {/* Always the muscle's total for this workout, named — on the first
                    lift for a muscle it equals this lift's own. */}
                <div className="eyebrow mt-0.5" style={{ fontSize: 11, color: "var(--ink)" }}>
                  {log.muscleGroup}
                </div>
                <div className="eyebrow" style={{ fontSize: 9 }}>eff reps</div>
              </div>
              <button
                onClick={() => setMenu((v) => !v)}
                aria-label="Effective reps by muscle"
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
          <div className="mb-3 rounded-2xl border border-line bg-panel p-3">
            <MusclePanel byMuscle={byMuscle} previous={previous} current={log.muscleGroup} />
          </div>
        )}

        {/* Above the sets, because a setup cue — seat notch, bar, grip — is
            read before the first one, not after the last. Its own section, not
            inside the Today column, whose tap opens the set sheet. */}
        <LiftNotes
          sessionId={sessionId}
          log={log}
          previous={last?.notes || note?.notes || ""}
          lastDate={last?.date ?? null}
        />

        <section className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="grid grid-cols-2">
            {/* ---------------------------------------------- last time */}
            <div className="border-r border-line px-3 py-3">
              {/* Tap to compare with any earlier workout of this lift, not
                  only the most recent. A bordered pill so it reads as a
                  control; orange while a picked (older) one is showing. */}
              {liftSessions.length > 0 && last ? (
                <button
                  type="button"
                  onClick={() => setChoosingLast(true)}
                  className={`eyebrow mb-1.5 inline-flex h-8 items-center gap-1.5 rounded-full border px-3
                              active:bg-panel-2 ${lastId ? "border-accent/70 bg-accent-soft" : "border-line-2 bg-panel-2"}`}
                  style={{ color: lastId ? "var(--accent)" : "var(--ink)" }}
                >
                  {lastId ? "" : "Last · "}
                  {new Date(last.date).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              ) : (
                <p className="eyebrow mb-1.5">Last</p>
              )}
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
                        {s.restPauseReps > 0 && <span className="text-ink"> + {s.restPauseReps}</span>}
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
            {/* Tapping anywhere in this column that is not a set opens the
                new-set sheet, same as + Add set; a set row opens that set. */}
            <div className="cursor-pointer px-3 py-3" onClick={openNew}>
              <p className="eyebrow mb-1.5 text-accent">Today</p>
              {done.length > 0 ? (
                <>
                <ul className="tnum space-y-0.5">
                  {done.map((s, i) => {
                    const score = effectiveReps(s);
                    return (
                      <li key={s.id}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSheet({
                            set: s, fillId: null,
                            setNumber: s.isWarmup ? i + 1 : numberAt(i),
                            weight: s.weight, reps: s.reps, rir: s.rir, isWarmup: s.isWarmup,
                            restPauseReps: s.restPauseReps,
                          }); }}
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
                            {s.restPauseReps > 0 && <span className="text-ink"> + {s.restPauseReps}</span>}
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
                {/* The header carries the muscle's total once another lift has
                    added to it, so this lift's own sum sits here instead. */}
                {muscleShared && (
                  <div className="mt-1.5 flex items-baseline justify-between border-t border-line pt-1.5">
                    <span className="eyebrow" style={{ fontSize: 9 }}>This lift</span>
                    <span className={`display tnum text-base font-semibold ${
                      exerciseTotal ? "text-accent" : "text-ink-faint"
                    }`}>
                      {exerciseTotal}
                    </span>
                  </div>
                )}
                </>
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

        {/* Done marks the lift finished and walks back to the list, where its
            row is now green. The write lands before the
            navigation, and `replace` so Back does not return to a finished lift. */}
        <div className="mt-10 flex justify-center">
          <Button
            variant="primary"
            // Set well apart from + Add set and narrower than it, so a thumb
            // reaching for another set does not land on Done instead.
            className="w-3/5"
            disabled={finishing}
            onClick={() => {
              setFinishing(true);
              void markExerciseDone(sessionId, log.id, true)
                .then(() => router.replace(`/log/${sessionId}`))
                .catch(() => setFinishing(false));
            }}
          >
            {finishing ? "Saving…" : "✓ Done"}
          </Button>
        </div>
        {log.isDone && (
          <button
            onClick={() => run(() => { void markExerciseDone(sessionId, log.id, false); })}
            className="mt-2 w-full py-2 text-center text-xs text-ink-faint underline"
          >
            Marked done · undo
          </button>
        )}
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

      {choosingLast && (
        <LastChooser
          options={liftSessions}
          selected={lastId ?? liftSessions[0]?.sessionId ?? null}
          unit={unit}
          onClose={() => setChoosingLast(false)}
          onPick={(id) => {
            setChoosingLast(false);
            // The newest one is the default, so picking it clears ?from.
            const url = id === liftSessions[0]?.sessionId
              ? `/log/${sessionId}/${log.id}`
              : `/log/${sessionId}/${log.id}?from=${id}`;
            router.replace(url, { scroll: false });
          }}
        />
      )}

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

/* ---------------------------------------------------------- muscle panel */

/**
 * Effective reps per muscle behind the ⋯ button, with two tabs, ordered like the
 * set columns (last on the left, today on the right): this workout so
 * far, and the workout before it (the last run of the same program day, else
 * the most recent one). Vladimir asked for the second tab in September 2026 to
 * see last time's per-muscle totals mid-workout. It replaced a per-session note
 * field that used to sit in this drawer. Bars are coloured against the paper's
 * 20–40 per session; they describe workouts, they never suggest a load.
 */
function MusclePanel({
  byMuscle, previous, current,
}: { byMuscle: MuscleSlice[]; previous: PreviousWorkout | null; current: string }) {
  const [tab, setTab] = useState<"today" | "last">("today");
  const showing = tab === "last" && previous ? previous.byMuscle : byMuscle;
  const lastLabel = previous
    ? new Date(previous.startedAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })
    : null;
  const tabClass = (on: boolean) =>
    `flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
      on ? "bg-panel-3 text-ink" : "text-ink-faint"
    }`;
  return (
    <div>
      <div className="mb-2.5 flex gap-1 rounded-lg bg-panel-2 p-1" role="tablist">
        <button role="tab" aria-selected={tab === "last"} className={tabClass(tab === "last")}
          onClick={() => setTab("last")} disabled={!previous}>
          {previous ? `Last · ${lastLabel}` : "No last workout"}
        </button>
        <button role="tab" aria-selected={tab === "today"} className={tabClass(tab === "today")}
          onClick={() => setTab("today")}>
          This workout
        </button>
      </div>
      {tab === "last" && previous && (
        <p className="mb-2 truncate text-xs text-ink-faint">{previous.dayName}</p>
      )}
      {showing.length === 0 ? (
        <p className="text-xs text-ink-faint">No working sets logged{tab === "today" ? " yet" : ""}.</p>
      ) : (
        <ul className="space-y-2.5">
          {showing.map((m) => {
            const band = sessionErBand(m.effectiveReps);
            return (
              <li key={m.muscleGroup}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className={m.muscleGroup === current ? "font-semibold text-ink" : "text-ink-dim"}>
                    {m.muscleGroup}
                  </span>
                  <span className="tnum text-xs text-ink-faint">
                    <span className={`display text-base font-semibold ${BAND_COLOR[band]}`}>
                      {m.effectiveReps}
                    </span>
                    {" · "}{m.scoredSets} of {m.workingSets} sets rated
                  </span>
                </div>
                <div className="mt-1">
                  <SessionErBar er={m.effectiveReps} band={band} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2.5 text-[11px] text-ink-faint">
        Shaded: {SESSION_ER_LOW}–{SESSION_ER_HIGH} effective reps per muscle per session.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- notes */

/**
 * Last session's note beside today's, split the same way as the sets below.
 *
 * Both are `exercise_logs.notes` — one session's note on one lift. The left
 * falls back to the library note (`exercises.notes`, still edited in the
 * exercise base) when last session left none, so the notes written before
 * this split kept showing. Vladimir asked for the split in September 2026:
 * he could read the old note and had nowhere to write today's.
 *
 * Each half is clamped to three lines and opens the whole note on tap — the
 * left read-only, the right to edit. Today's is saved when the window closes,
 * explicitly rather than on blur, because iOS often skips the blur when a
 * fixed overlay unmounts.
 */
function LiftNotes({
  sessionId, log, previous, lastDate,
}: {
  sessionId: string; log: ExerciseLog; previous: string; lastDate: string | null;
}) {
  const [, startTransition] = useTransition();
  const [today, setToday] = useState(log.notes);
  const [open, setOpen] = useState<"last" | "today" | null>(null);
  // Walking to the next lift reuses this component; take the new lift's note.
  useEffect(() => { setToday(log.notes); }, [log.id, log.notes]);

  const lastLabel = lastDate
    ? new Date(lastDate).toLocaleDateString("en-US", { day: "numeric", month: "short" })
    : "Last";

  function save(value: string) {
    setOpen(null);
    const trimmed = value.trim();
    setToday(trimmed);
    if (trimmed === log.notes.trim()) return;
    startTransition(() => { void noteExercise(sessionId, log.id, trimmed); });
  }

  return (
    <>
      <section className="mb-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-panel">
        <button
          onClick={() => previous && setOpen("last")}
          disabled={!previous}
          className="flex min-w-0 flex-col justify-start border-r border-line px-3 py-2.5 text-left active:bg-panel-2"
        >
          <p className="eyebrow mb-1">Note · {lastLabel}</p>
          <p className={`line-clamp-3 whitespace-pre-wrap break-words text-sm ${
            previous ? "text-ink-dim" : "text-ink-faint"
          }`}>
            {previous || "No note."}
          </p>
        </button>
        <button
          onClick={() => setOpen("today")}
          className="flex min-w-0 flex-col justify-start px-3 py-2.5 text-left active:bg-panel-2"
        >
          <p className="eyebrow mb-1 text-accent">Note · Today</p>
          <p className={`line-clamp-3 whitespace-pre-wrap break-words text-sm ${
            today ? "text-ink" : "text-ink-faint"
          }`}>
            {today || "Tap to add a note"}
          </p>
        </button>
      </section>

      {open && (
        <NoteWindow
          title={open === "last" ? `Note · ${lastLabel}` : "Note · Today"}
          text={open === "last" ? previous : today}
          editable={open === "today"}
          onClose={(value) => (open === "today" ? save(value) : setOpen(null))}
        />
      )}
    </>
  );
}

/** The whole of one note. Anchored to the top so the keyboard, when today's
 *  note is being written, comes up below it rather than over it. */
function NoteWindow({
  title, text, editable, onClose,
}: {
  title: string; text: string; editable: boolean; onClose: (value: string) => void;
}) {
  const [value, setValue] = useState(text);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70 px-4 backdrop-blur-sm"
      style={{ paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}
      onClick={() => onClose(value)}
    >
      <div
        className="mx-auto w-full max-w-2xl rounded-2xl border border-line-2 bg-panel p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className={`eyebrow ${editable ? "text-accent" : ""}`}>{title}</p>
          <button
            onClick={() => onClose(value)}
            className="display h-11 rounded-lg px-3 text-base font-semibold text-accent"
          >
            {editable ? "Save" : "Close"}
          </button>
        </div>
        {editable ? (
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder="How it went, what to change next time"
            className={`${inputClass} py-2 text-base`}
          />
        ) : (
          <p className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-base text-ink">
            {text}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The part of the screen the on-screen keyboard leaves showing.
 *
 * A `position: fixed` element is laid out against the *layout* viewport, which
 * iOS Safari does not shrink when the keyboard comes up — so a sheet pinned to
 * the bottom ends up underneath it. The visual viewport is the part still
 * showing, and the sheet is pinned to exactly that: its top and height.
 *
 * It used to subtract the keyboard from the bottom instead, and the sheet still
 * sat a little under the keyboard: iOS pans the page up *after* the resize
 * event, and the sum was taken mid-animation. Pinning to top + height and
 * measuring again on the next frames, and on any page scroll, settles it.
 *
 * Null on a desktop and on any browser without the API, where the sheet simply
 * fills the screen as before. `keyboard` is true while one is up.
 */
function useVisibleArea(): { top: number; height: number; keyboard: boolean } | null {
  const [area, setArea] = useState<{ top: number; height: number; keyboard: boolean } | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const measure = () => setArea({
      top: Math.round(vv.offsetTop),
      height: Math.round(vv.height),
      keyboard: window.innerHeight - vv.height > 80,
    });
    let frames = 0;
    let raf = 0;
    // iOS reports the final position a few frames late, so keep reading briefly.
    const update = () => {
      measure();
      cancelAnimationFrame(raf);
      frames = 0;
      const tick = () => { measure(); if (++frames < 20) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
    };
  }, []);

  return area;
}

/* ---------------------------------------------------------- last chooser */

/**
 * Picks which earlier workout of this lift sits in the left column. Newest
 * first, with the heaviest set of each so the right day is found at a glance.
 * Only this screen changes — nothing is saved.
 */
function LastChooser({
  options, selected, unit, onPick, onClose,
}: {
  options: LiftSessionOption[];
  selected: string | null;
  unit: string;
  onPick: (sessionId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm">
      <button className="min-h-0 flex-1" aria-label="Close" onClick={onClose} />
      <div className="rise mx-auto flex max-h-[75vh] w-full max-w-2xl flex-col rounded-t-3xl
                      border-t border-line-2 bg-panel">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
          <h2 className="display text-2xl font-semibold">Compare with</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 shrink-0 rounded-lg border border-line-2 text-ink-dim"
          >
            ✕
          </button>
        </div>
        <ul
          className="min-h-0 flex-1 overflow-y-auto px-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {options.map((o, i) => {
            const on = o.sessionId === selected;
            return (
              <li key={o.sessionId}>
                <button
                  onClick={() => onPick(o.sessionId)}
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left ${
                    on ? "border-accent bg-accent-soft" : "border-line bg-panel-2 active:bg-panel"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="display block text-lg font-semibold leading-tight">
                      {new Date(o.date).toLocaleDateString("en-US", {
                        weekday: "short", day: "numeric", month: "short", year: "numeric",
                      })}
                      {i === 0 && <span className="ml-2 text-xs font-normal text-ink-faint">most recent</span>}
                    </span>
                    <span className="block truncate text-[11px] text-ink-faint">{o.dayName}</span>
                  </span>
                  <span className="tnum shrink-0 text-right text-sm">
                    <span className="text-ink">{o.topWeight} {unit} × {o.topReps}</span>
                    <span className="block text-[11px] text-ink-faint">
                      {o.sets} set{o.sets === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- set sheet */

type SetValues = {
  weight: number; reps: number; rir: number | null; isWarmup: boolean; restPauseReps: number;
};

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
  // Rest-pause: `reps` becomes the activation set and a second box takes the
  // total of the mini-sets after it. Same rule as the EffectiveReps page.
  const [restPause, setRestPause] = useState(target.restPauseReps > 0);
  const [miniSets, setMiniSets] = useState(target.restPauseReps ? String(target.restPauseReps) : "");
  // Not editable any more — the checkbox is gone and a rating over
  // MAX_COUNTED_RIR does that job. Old rows keep the flag they were saved with.
  const isWarmup = target.isWarmup;

  const weightNum = Number(weight) || 0;
  const repsNum = Number(reps) || 0;
  const miniNum = restPause ? Math.round(Number(miniSets) || 0) : 0;
  const canSave = repsNum > 0 && (!restPause || miniNum > 0);
  const score = effectiveReps({
    reps: repsNum, rir, isWarmup, isCompleted: true, restPauseReps: miniNum,
  });
  // What this set number looked like last week, shown so the sheet answers the
  // question without the user closing it to go and read the card.
  const lastMatch = last?.sets.find((s) => s.setNumber === target.setNumber);

  const area = useVisibleArea();
  const keyboard = area?.keyboard ?? false;

  return (
    <>
    {/* Solid fill under the keyboard. The iOS keyboard bar is see-through, and
        without this the screen's orange Done button showed through it. */}
    {area?.keyboard && (
      <div
        aria-hidden
        className="fixed inset-x-0 z-50 bg-panel"
        style={{ top: area.top + area.height, height: "100lvh" }}
      />
    )}
    <div
      className="fixed inset-x-0 top-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm"
      style={area ? { top: area.top, height: area.height } : { bottom: 0 }}
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
                  {lastMatch.restPauseReps > 0 && ` + ${lastMatch.restPauseReps}`}
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

          <button
            role="switch"
            aria-checked={restPause}
            // Same as the rating chips: keeps focus in the number field so the
            // keyboard stays up and the sheet does not bounce.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setRestPause((v) => !v)}
            className={`mt-4 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5
                        text-left ${restPause ? "border-accent/60 bg-accent-soft" : "border-line-2 bg-panel-2"}`}
          >
            <span className="text-sm font-semibold text-ink">
              Rest-pause set
              <span className="block text-[11px] font-normal text-ink-faint">
                Activation set, then short mini-sets
              </span>
            </span>
            <span
              aria-hidden
              className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                restPause ? "bg-accent" : "bg-line-2"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  restPause ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>

          {/* Weight × reps, typed. Nothing between the two boxes but the ×.
              Rest-pause adds a third: + the mini-set reps. */}
          <div className="mt-3 flex items-end gap-2">
            <NumberField label={unit} value={weight} onChange={setWeight} decimal autoFocus />
            <span className="display pb-3 text-2xl font-semibold text-ink-faint">×</span>
            <NumberField label={restPause ? "Activation" : "Reps"} value={reps} onChange={setReps} />
            {restPause && (
              <>
                <span className="display pb-3 text-2xl font-semibold text-ink-faint">+</span>
                <NumberField label="Mini-sets" value={miniSets} onChange={setMiniSets} />
              </>
            )}
          </div>
          {!canSave && (
            <p className="mt-1.5 text-center text-[11px] text-ink-faint">
              {repsNum <= 0
                ? `Enter the ${restPause ? "activation " : ""}reps to log this set.`
                : "Enter the mini-set reps — all of them, added up."}
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
                {restPause
                  ? <>Rate the activation set. It scores {EFFECTIVE_REP_THRESHOLD} − RIR as usual,
                      and every mini-set rep counts on top. Over {MAX_COUNTED_RIR} the whole set
                      does not count.</>
                  : <>Reps you could still have done. {EFFECTIVE_REP_THRESHOLD} − RIR counts, capped at
                      the reps you did. Over {MAX_COUNTED_RIR} the set does not count at all — that is
                      a warm-up. Leave it blank and the set is logged but not scored.</>}
              </p>
            </div>
          )}
        </div>

        {/* Always reachable, whatever the keyboard is covering. */}
        <div
          className="flex gap-2 border-t border-line px-4 pt-3"
          style={{
            paddingBottom: keyboard
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
            disabled={!canSave}
            onClick={() => onSave({
              weight: weightNum, reps: repsNum, rir, isWarmup, restPauseReps: miniNum,
            })}
          >
            {target.set ? "Save set" : "Log set"}
          </Button>
        </div>
      </div>
    </div>
    </>
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
