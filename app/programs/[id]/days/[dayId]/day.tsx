"use client";

import { useState, useTransition } from "react";
import { removeDay, saveDay, startWorkout } from "@/app/actions";
import { Button, Header, Page, inputClass } from "@/components/ui";
import { DragHandle, useDragReorder } from "@/components/drag-list";
import { ExercisePicker } from "@/components/exercise-picker";
import { MUSCLE_GROUPS } from "@/lib/types";
import type { Exercise, Program, ProgramDay } from "@/lib/types";

type Draft = {
  key: string;
  exerciseId: string | null;
  name: string;
  muscleGroup: string;
  plannedSets: number;
  plannedReps: number;
};

// A stable key per row so React keeps the right row expanded while the list is
// dragged. An array index would move every row's identity on a single swap.
const key = () => Math.random().toString(36).slice(2);

/**
 * One day of a program, on its own page.
 *
 * Everything here is a local draft until **Save day** is pressed — the whole
 * point of splitting the editor up was to work on one day at a time and know
 * when it was written. Sets and reps stay folded away behind the summary line,
 * because scanning a day is about which lifts are in it and in what order.
 */
export function DayEditor({
  program, day, library: seedLibrary,
}: { program: Program; day: ProgramDay; library: Exercise[] }) {
  const [library, setLibrary] = useState(seedLibrary);
  const [name, setName] = useState(day.name);
  const [rows, setRows] = useState<Draft[]>(() => day.exercises.map((e) => ({
    key: key(),
    exerciseId: e.exerciseId,
    name: e.name,
    muscleGroup: e.muscleGroup,
    plannedSets: e.plannedSets,
    plannedReps: e.plannedReps,
  })));
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const { listRef, dragging, handleProps } = useDragReorder(rows, (next) => {
    setRows(next); setDirty(true); setSaved(false);
  });

  function edit(rowKey: string, change: (row: Draft) => Draft) {
    setRows((current) => current.map((r) => (r.key === rowKey ? change(r) : r)));
    setDirty(true);
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await saveDay(program.id, day.id, name, rows.map((r) => ({
        exerciseId: r.exerciseId,
        name: r.name,
        muscleGroup: r.muscleGroup,
        plannedSets: r.plannedSets,
        plannedReps: r.plannedReps,
      })));
      setDirty(false);
      setSaved(true);
    });
  }

  const totalSets = rows.reduce((n, r) => n + r.plannedSets, 0);

  return (
    <Page>
      <Header
        back={{ href: `/programs/${program.id}`, label: program.name }}
        eyebrow="Edit day"
        title={name || "Day"}
        subtitle={`${rows.length} lift${rows.length === 1 ? "" : "s"} · ${totalSets} planned sets`}
      />

      <input
        value={name}
        onChange={(e) => { setName(e.target.value); setDirty(true); setSaved(false); }}
        placeholder="Day name"
        aria-label="Day name"
        className={`${inputClass} display text-xl font-semibold`}
      />

      {rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line-2 px-4 py-8 text-center
                      text-sm text-ink-faint">
          No lifts in this day yet.
        </p>
      ) : (
        <ul ref={listRef} className="mt-3 space-y-1.5">
          {rows.map((row, i) => {
            const open = openRow === row.key;
            return (
              <li
                key={row.key}
                className={`rounded-xl border bg-panel transition-colors ${
                  dragging === i ? "border-accent bg-panel-2" : "border-line"
                }`}
              >
                <div className="flex items-center gap-1 pr-1">
                  <span {...handleProps(i)}><DragHandle label={`Reorder ${row.name}`} /></span>

                  <div className="min-w-0 flex-1 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 truncate text-sm">{row.name}</span>
                      {/* The muscle group, right after the name, as a chip you
                          tap. A native select so it is one tap on a phone. */}
                      <span className="relative shrink-0">
                        <select
                          value={row.muscleGroup}
                          onChange={(e) => edit(row.key, (r) => ({ ...r, muscleGroup: e.target.value }))}
                          aria-label={`Muscle group for ${row.name}`}
                          className="appearance-none rounded-full border border-line-2 bg-panel-2
                                     py-0.5 pl-2 pr-5 text-[11px] text-ink-dim outline-none
                                     focus:border-accent"
                        >
                          {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <svg
                          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-faint"
                          width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                        >
                          <path d="M5 9l7 7 7-7" />
                        </svg>
                      </span>
                    </div>

                    {/* Folded away by default — this is the line you scan. */}
                    <button
                      onClick={() => setOpenRow(open ? null : row.key)}
                      className="tnum mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint"
                    >
                      {row.plannedSets} × {row.plannedReps}
                      <svg
                        className={`transition-transform ${open ? "rotate-180" : ""}`}
                        width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                      >
                        <path d="M5 9l7 7 7-7" />
                      </svg>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setRows((current) => current.filter((r) => r.key !== row.key));
                      setDirty(true); setSaved(false);
                    }}
                    aria-label={`Remove ${row.name}`}
                    className="h-9 w-8 shrink-0 rounded-lg text-ink-faint active:bg-panel-2"
                  >
                    ×
                  </button>
                </div>

                {open && (
                  <div className="flex items-center gap-2 border-t border-line px-2 py-2">
                    <Field
                      label="Sets"
                      value={row.plannedSets}
                      onChange={(v) => edit(row.key, (r) => ({ ...r, plannedSets: v }))}
                    />
                    <span className="display pt-4 text-lg text-ink-faint">×</span>
                    <Field
                      label="Reps"
                      value={row.plannedReps}
                      onChange={(v) => edit(row.key, (r) => ({ ...r, plannedReps: v }))}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Button className="mt-3 w-full" onClick={() => setPicking(true)}>+ Add lifts</Button>

      <div className="mt-5 space-y-2">
        <Button
          variant="primary"
          className="w-full"
          disabled={pending || !dirty}
          onClick={save}
        >
          {pending ? "Saving…" : dirty ? "Save day" : saved ? "Saved" : "No changes"}
        </Button>
        {dirty && (
          <p className="text-center text-[11px] text-warn">
            Unsaved changes — leaving this page loses them.
          </p>
        )}

        <form action={startWorkout.bind(null, day.id)}>
          <Button type="submit" className="w-full" disabled={dirty || rows.length === 0}>
            Start this day
          </Button>
        </form>

        <Button
          variant="danger"
          className="w-full"
          disabled={pending}
          onClick={() => {
            if (confirm(`Remove "${day.name}" from ${program.name}? Sessions already logged from it are kept.`)) {
              startTransition(() => { void removeDay(program.id, day.id); });
            }
          }}
        >
          Delete day
        </Button>
      </div>

      {picking && (
        <ExercisePicker
          library={library}
          onClose={() => setPicking(false)}
          onCreated={(exercise) => setLibrary((current) =>
            [...current, exercise].sort((a, b) =>
              a.muscleGroup.localeCompare(b.muscleGroup) || a.name.localeCompare(b.name)))}
          onAdd={(exercises) => {
            setRows((current) => [...current, ...exercises.map((e) => ({
              key: key(),
              exerciseId: e.id,
              name: e.name,
              muscleGroup: e.muscleGroup,
              plannedSets: 3,
              plannedReps: 10,
            }))]);
            setDirty(true);
            setSaved(false);
            setPicking(false);
          }}
        />
      )}
    </Page>
  );
}

function Field({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex-1">
      <span className="eyebrow block text-center">{label}</span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        aria-label={label}
        className="display tnum mt-0.5 h-11 w-full rounded-xl border border-line-2 bg-panel-2
                   text-center text-2xl font-semibold text-ink outline-none focus:border-accent"
      />
    </label>
  );
}
