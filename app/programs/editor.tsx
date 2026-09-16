"use client";

import { useState, useTransition } from "react";
import { createExercise, removeProgram, saveProgramAction, startWorkout } from "@/app/actions";
import { Button, Header, Page, Panel, inputClass } from "@/components/ui";
import { MUSCLE_GROUPS } from "@/lib/types";
import { WEEKLY_SETS_FLOOR, WEEKLY_SETS_HIGH, WEEKLY_SETS_LOW } from "@/lib/targets";
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
  program, library: seedLibrary,
}: { program: Program | null; library: Exercise[] }) {
  // Held in state so a lift created from the picker is searchable straight away,
  // without waiting for the page to be re-fetched from the server.
  const [library, setLibrary] = useState(seedLibrary);
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
      <Header
        back={{ href: "/programs", label: "Programs" }}
        title={program ? "Edit program" : "New program"}
      />

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

      <div className="mt-3 rounded-2xl border border-line bg-panel p-3">
        <p className="eyebrow">Planned sets a week</p>
        <p className="tnum mt-1 text-sm text-ink-dim">
          {days.length} day{days.length === 1 ? "" : "s"} · {weeklySets} sets
        </p>
        {perMuscle.size > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {[...perMuscle.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([m, n]) => (
                <li
                  key={m}
                  className={`rounded-lg border px-2 py-1 text-xs ${
                    n >= WEEKLY_SETS_LOW && n <= WEEKLY_SETS_HIGH
                      ? "border-good/40 text-good"
                      : n < WEEKLY_SETS_FLOOR ? "border-bad/40 text-bad" : "border-line-2 text-ink-dim"
                  }`}
                >
                  {m} <span className="display text-sm font-semibold">{n}</span>
                </li>
              ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-ink-faint">
          Green: {WEEKLY_SETS_LOW}–{WEEKLY_SETS_HIGH} sets a week, the productive range.
          Red: under the {WEEKLY_SETS_FLOOR}-set floor. Planned, not performed — hard sets are
          counted after the fact on Stats.
        </p>
      </div>

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
                + Add lifts
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
          onCreated={(exercise) => setLibrary((current) =>
            [...current, exercise].sort((a, b) =>
              a.muscleGroup.localeCompare(b.muscleGroup) || a.name.localeCompare(b.name)))}
          onAdd={(exercises) => {
            editDay(pickingFor, (d) => ({
              ...d,
              exercises: [...d.exercises, ...exercises.map((exercise) => ({
                key: key(),
                exerciseId: exercise.id,
                name: exercise.name,
                muscleGroup: exercise.muscleGroup,
                plannedSets: 3,
                plannedReps: 10,
              }))],
            }));
            setPickingFor(null);
          }}
        />
      )}
    </Page>
  );
}

/**
 * Adds lifts to a day.
 *
 * Three things it has to do that the old one-tap-one-lift version did not:
 * filter by muscle group, take several lifts in a single visit, and create a
 * lift that is not in the library yet — which then arrives selected, so it goes
 * into the day without being searched for a second time.
 */
function Picker({
  library, onAdd, onCreated, onClose,
}: {
  library: Exercise[];
  onAdd: (exercises: Exercise[]) => void;
  onCreated: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<string>(MUSCLE_GROUPS[0]);
  const [newCompound, setNewCompound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const groups = MUSCLE_GROUPS.filter((m) => library.some((e) => e.muscleGroup === m));
  const matches = library.filter((e) =>
    (q === "" || e.name.toLowerCase().includes(q)) && (group === null || e.muscleGroup === group));
  const isChosen = (id: string) => chosen.some((c) => c.id === id);

  function toggle(exercise: Exercise) {
    setChosen((current) => current.some((c) => c.id === exercise.id)
      ? current.filter((c) => c.id !== exercise.id)
      : [...current, exercise]);
  }

  /** Opens the new-exercise dialog, seeded with whatever was typed in the search
   *  box and with the group already filtered to, since both are usually right. */
  function openCreate() {
    setNewName(query.trim());
    if (group) setNewGroup(group);
    setError(null);
    setCreating(true);
  }

  function create() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const result = await createExercise(name, newGroup, newCompound);
      if (!result?.ok) { setError(result?.error ?? "Could not add that."); return; }
      // Straight into the selection, so it lands in the day on the next tap
      // rather than being hunted for again.
      const made: Exercise = {
        id: result.id, name, muscleGroup: newGroup,
        isCompound: newCompound, notes: "", isPreset: false,
      };
      onCreated(made);
      setChosen((current) => [...current, made]);
      setCreating(false);
      setNewName("");
      setQuery("");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur"
         style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden px-4 pt-4">
        <div className="flex gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setError(null); }}
            placeholder="Search by name"
            className={inputClass}
          />
          <Button onClick={onClose}>Close</Button>
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]
                        [&::-webkit-scrollbar]:hidden">
          {[null, ...groups].map((g) => (
            <button
              key={g ?? "all"}
              onClick={() => setGroup(g)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                group === g
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line-2 text-ink-dim"
              }`}
            >
              {g ?? "All"}
            </button>
          ))}
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pb-4">
          {/* Always here, not only when a search misses — adding a lift is a
              thing you set out to do, not only something you fall back to. */}
          <button
            onClick={openCreate}
            className="mb-2 w-full rounded-xl border border-dashed border-accent/50 px-3 py-3
                       text-left text-sm text-accent active:bg-accent-soft"
          >
            + New exercise
            <span className="block text-[11px] text-ink-faint">
              Added to the library and straight into this day.
            </span>
          </button>

          <ul className="space-y-1">
            {matches.map((e) => {
              const picked = isChosen(e.id);
              return (
                <li key={e.id}>
                  <button
                    onClick={() => toggle(e)}
                    aria-pressed={picked}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left
                                transition-colors ${
                      picked ? "border-accent bg-accent-soft" : "border-line bg-panel"
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      picked ? "border-accent bg-accent text-black" : "border-line-2"
                    }`}>
                      {picked && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    <span className="shrink-0 text-[11px] text-ink-faint">{e.muscleGroup}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {matches.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-faint">
              {q === ""
                ? `Nothing in ${group ?? "the library"} yet.`
                : `Nothing matches “${query.trim()}”.`}
            </p>
          )}
        </div>

        {creating && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75
                          px-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-line-2 bg-panel p-4">
              <h3 className="display text-2xl font-semibold">New exercise</h3>
              <p className="mt-0.5 text-[11px] text-ink-faint">
                Goes into the library and into this day.
              </p>

              <input
                autoFocus
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) create(); }}
                placeholder="Exercise name"
                aria-label="Exercise name"
                className={`${inputClass} mt-3`}
              />

              <div className="mt-2 flex gap-2">
                <select
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  className={inputClass}
                  aria-label="Muscle group"
                >
                  {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <label className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border
                                  border-line-2 bg-panel-2 px-3 text-sm text-ink-dim">
                  <input
                    type="checkbox"
                    checked={newCompound}
                    onChange={(e) => setNewCompound(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Compound
                </label>
              </div>

              {error && <p className="mt-2 text-sm text-bad">{error}</p>}

              <div className="mt-3 flex gap-2">
                <Button onClick={() => { setCreating(false); setError(null); }}>Cancel</Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  disabled={pending || !newName.trim()}
                  onClick={create}
                >
                  {pending ? "Adding…" : "Add exercise"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Stays put while the list scrolls, so the count is always in sight. */}
        <div
          className="border-t border-line pt-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <Button
            variant="primary"
            className="w-full"
            disabled={chosen.length === 0}
            onClick={() => onAdd(chosen)}
          >
            {chosen.length === 0
              ? "Pick some lifts"
              : `Add ${chosen.length} lift${chosen.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
