"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { removeProgram, saveProgramAction, startWorkout } from "@/app/actions";
import { Button, Header, Page, Panel, inputClass } from "@/components/ui";
import { MUSCLE_GROUPS } from "@/lib/types";
import type { Exercise, Program } from "@/lib/types";

type DraftExercise = {
  key: string;
  exerciseId: string | null;
  name: string;
  muscleGroup: string;
  plannedSets: number;
  plannedReps: number;
};

/* `savedId` is the program_days row this draft day came from, or null for one
   added since the last save. It is what "Start this day" starts, so reordering
   days in the editor can never start the wrong one. */
type DraftDay = {
  key: string; savedId: string | null; name: string; exercises: DraftExercise[];
};

// A stable key per row so React keeps focus in the right input while the list is
// reordered. Array index would move every row's identity on a single swap.
const key = () => Math.random().toString(36).slice(2);

function toDraft(program: Program | null): { name: string; description: string; days: DraftDay[] } {
  if (!program) {
    return {
      name: "", description: "",
      days: [{ key: key(), savedId: null, name: "Day 1", exercises: [] }],
    };
  }
  return {
    name: program.name,
    description: program.description,
    days: program.days.map((d) => ({
      key: key(),
      savedId: d.id,
      name: d.name,
      exercises: d.exercises.map((e) => ({
        key: key(),
        exerciseId: e.exerciseId,
        name: e.name,
        muscleGroup: e.muscleGroup,
        plannedSets: e.plannedSets,
        plannedReps: e.plannedReps,
      })),
    })),
  };
}

export function ProgramEditor({
  program, library,
}: { program: Program | null; library: Exercise[] }) {
  const initial = toDraft(program);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [days, setDays] = useState<DraftDay[]>(initial.days);
  const [pending, startTransition] = useTransition();
  const [pickingFor, setPickingFor] = useState<string | null>(null);

  function editDay(dayKey: string, change: (d: DraftDay) => DraftDay) {
    setDays((current) => current.map((d) => (d.key === dayKey ? change(d) : d)));
  }

  function moveDay(index: number, by: number) {
    const next = index + by;
    if (next < 0 || next >= days.length) return;
    setDays((current) => {
      const copy = [...current];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  }

  function moveExercise(dayKey: string, index: number, by: number) {
    editDay(dayKey, (d) => {
      const next = index + by;
      if (next < 0 || next >= d.exercises.length) return d;
      const copy = [...d.exercises];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return { ...d, exercises: copy };
    });
  }

  const weeklySets = days.reduce(
    (sum, d) => sum + d.exercises.reduce((n, e) => n + e.plannedSets, 0), 0);

  const perMuscle = new Map<string, number>();
  for (const d of days) {
    for (const e of d.exercises) {
      perMuscle.set(e.muscleGroup, (perMuscle.get(e.muscleGroup) ?? 0) + e.plannedSets);
    }
  }

  function save() {
    startTransition(() => {
      void saveProgramAction({
        id: program?.id ?? null,
        name,
        description,
        days: days.map((d) => ({
          name: d.name,
          exercises: d.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            name: e.name,
            muscleGroup: e.muscleGroup,
            plannedSets: e.plannedSets,
            plannedReps: e.plannedReps,
          })),
        })),
      });
    });
  }

  return (
    <Page>
      <Link href="/programs" className="text-sm text-accent">‹ Programs</Link>
      <Header title={program ? "Edit program" : "New program"} />

      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Program name"
          className={inputClass}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this program is for (optional)"
          rows={2}
          className={`${inputClass} py-2`}
        />
      </div>

      <p className="tnum mt-2 text-xs text-ink-faint">
        {days.length} days · {weeklySets} planned sets a week
        {perMuscle.size > 0 && " · "}
        {[...perMuscle.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([m, n]) => `${m} ${n}`)
          .join(", ")}
      </p>

      <div className="mt-4 space-y-3">
        {days.map((day, dayIndex) => (
          <Panel key={day.key}>
            <div className="flex items-center gap-2">
              <input
                value={day.name}
                onChange={(e) => editDay(day.key, (d) => ({ ...d, name: e.target.value }))}
                className={`${inputClass} font-medium`}
              />
              <button
                onClick={() => moveDay(dayIndex, -1)}
                disabled={dayIndex === 0}
                aria-label="Move day up"
                className="h-11 w-9 shrink-0 rounded-lg border border-line text-ink-faint disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => moveDay(dayIndex, 1)}
                disabled={dayIndex === days.length - 1}
                aria-label="Move day down"
                className="h-11 w-9 shrink-0 rounded-lg border border-line text-ink-faint disabled:opacity-30"
              >
                ↓
              </button>
            </div>

            <ul className="mt-3 space-y-2">
              {day.exercises.map((ex, exIndex) => (
                <li key={ex.key} className="rounded-lg border border-line bg-panel-2 p-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{ex.name}</span>
                    <button
                      onClick={() => moveExercise(day.key, exIndex, -1)}
                      disabled={exIndex === 0}
                      aria-label="Move up"
                      className="h-9 w-8 shrink-0 rounded border border-line text-xs text-ink-faint disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveExercise(day.key, exIndex, 1)}
                      disabled={exIndex === day.exercises.length - 1}
                      aria-label="Move down"
                      className="h-9 w-8 shrink-0 rounded border border-line text-xs text-ink-faint disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => editDay(day.key, (d) => ({
                        ...d, exercises: d.exercises.filter((x) => x.key !== ex.key),
                      }))}
                      aria-label={`Remove ${ex.name}`}
                      className="h-9 w-8 shrink-0 rounded border border-line text-xs text-ink-faint"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-ink-faint">
                    <label className="flex items-center gap-1">
                      <input
                        inputMode="numeric"
                        value={ex.plannedSets}
                        onChange={(e) => editDay(day.key, (d) => ({
                          ...d,
                          exercises: d.exercises.map((x) => x.key === ex.key
                            ? { ...x, plannedSets: Number(e.target.value) || 0 } : x),
                        }))}
                        className="tnum h-9 w-12 rounded border border-line bg-panel px-1 text-center text-ink"
                      />
                      sets
                    </label>
                    <span>×</span>
                    <label className="flex items-center gap-1">
                      <input
                        inputMode="numeric"
                        value={ex.plannedReps}
                        onChange={(e) => editDay(day.key, (d) => ({
                          ...d,
                          exercises: d.exercises.map((x) => x.key === ex.key
                            ? { ...x, plannedReps: Number(e.target.value) || 0 } : x),
                        }))}
                        className="tnum h-9 w-12 rounded border border-line bg-panel px-1 text-center text-ink"
                      />
                      reps
                    </label>
                    <select
                      value={ex.muscleGroup}
                      onChange={(e) => editDay(day.key, (d) => ({
                        ...d,
                        exercises: d.exercises.map((x) => x.key === ex.key
                          ? { ...x, muscleGroup: e.target.value } : x),
                      }))}
                      className="ml-auto h-9 rounded border border-line bg-panel px-1 text-ink"
                    >
                      {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex gap-2">
              <Button className="flex-1" onClick={() => setPickingFor(day.key)}>
                + Exercise
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (days.length === 1) return;
                  if (confirm(`Remove ${day.name}?`)) {
                    setDays((current) => current.filter((d) => d.key !== day.key));
                  }
                }}
                disabled={days.length === 1}
              >
                Remove day
              </Button>
            </div>

            {day.savedId && (
              // Only on a day that has been saved — a day added since then has
              // no row to start from, and starting it would silently begin an
              // empty freestyle session instead.
              <form action={startWorkout.bind(null, day.savedId)} className="mt-2">
                <Button type="submit" className="w-full text-xs">Start this day</Button>
              </form>
            )}
          </Panel>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <Button
          className="w-full"
          onClick={() => setDays((current) => [
            ...current,
            { key: key(), savedId: null, name: `Day ${current.length + 1}`, exercises: [] },
          ])}
        >
          + Add day
        </Button>
        <Button variant="primary" className="w-full" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save program"}
        </Button>
        {program && (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (confirm(`Delete "${program.name}"? Sessions already logged from it are kept.`)) {
                startTransition(() => { void removeProgram(program.id); });
              }
            }}
          >
            Delete program
          </Button>
        )}
      </div>

      {pickingFor && (
        <Picker
          library={library}
          onClose={() => setPickingFor(null)}
          onPick={(exercise) => {
            editDay(pickingFor, (d) => ({
              ...d,
              exercises: [...d.exercises, {
                key: key(),
                exerciseId: exercise?.id ?? null,
                name: exercise?.name ?? "",
                muscleGroup: exercise?.muscleGroup ?? "Other",
                plannedSets: 3,
                plannedReps: 10,
              }],
            }));
            setPickingFor(null);
          }}
        />
      )}
    </Page>
  );
}

function Picker({
  library, onPick, onClose,
}: {
  library: Exercise[];
  onPick: (exercise: Exercise | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q === "" ? library : library.filter((e) => e.name.toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur"
         style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-4">
        <div className="flex gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the library"
            className={inputClass}
          />
          <Button onClick={onClose}>Close</Button>
        </div>
        <ul className="mt-3 flex-1 space-y-1 overflow-y-auto pb-6">
          {matches.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onPick(e)}
                className="flex w-full items-center justify-between rounded-lg border
                           border-line bg-panel px-3 py-3 text-left"
              >
                <span className="truncate">{e.name}</span>
                <span className="ml-2 shrink-0 text-[11px] text-ink-faint">{e.muscleGroup}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="py-8 text-center text-sm text-ink-faint">
              Nothing matches. Add it on the{" "}
              <Link href="/exercises" className="text-accent underline">Exercises</Link> page first.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
