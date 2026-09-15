"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createExercise, editExercise, removeExercise } from "@/app/actions";
import { Button, Empty, Header, Page, Panel, inputClass } from "@/components/ui";
import { MUSCLE_GROUPS } from "@/lib/types";
import type { Exercise } from "@/lib/types";

export function Library({ exercises }: { exercises: Exercise[] }) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const matches = q === ""
    ? exercises
    : exercises.filter((e) =>
        e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q));

  const byGroup = new Map<string, Exercise[]>();
  for (const e of matches) {
    byGroup.set(e.muscleGroup, [...(byGroup.get(e.muscleGroup) ?? []), e]);
  }

  return (
    <Page>
      <Header
        title="Exercises"
        subtitle={`${exercises.length} in the library`}
        action={
          <Button variant="primary" onClick={() => { setAdding(true); setError(null); }}>
            New
          </Button>
        }
      />

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        className={`${inputClass} mb-4`}
      />

      {adding && (
        <Panel className="mb-4">
          <AddForm
            pending={pending}
            error={error}
            onCancel={() => { setAdding(false); setError(null); }}
            onSubmit={(name, muscleGroup, isCompound) => {
              startTransition(async () => {
                const result = await createExercise(name, muscleGroup, isCompound);
                if (result?.ok) { setAdding(false); setError(null); }
                else setError(result?.error ?? "Could not add that.");
              });
            }}
          />
        </Panel>
      )}

      {matches.length === 0 ? (
        <Empty>
          Nothing matches. {exercises.length === 0 && (
            <>Run <code>npm run db:push</code> to seed the preset library.</>
          )}
        </Empty>
      ) : (
        <div className="space-y-5">
          {[...byGroup.entries()].map(([group, list]) => (
            <section key={group}>
              <h2 className="mb-2 text-xs uppercase tracking-wide text-ink-faint">{group}</h2>
              <ul className="space-y-1.5">
                {list.map((e) => (
                  <li key={e.id}>
                    {editingId === e.id ? (
                      <Panel>
                        <EditForm
                          exercise={e}
                          pending={pending}
                          onCancel={() => setEditingId(null)}
                          onSave={(name, muscleGroup, isCompound, notes) => {
                            startTransition(() => {
                              void editExercise(e.id, name, muscleGroup, isCompound, notes);
                              setEditingId(null);
                            });
                          }}
                          onDelete={() => {
                            if (confirm(
                              `Delete "${e.name}" from the library?\n\n` +
                              "Programs and past sessions keep the name — only the library entry goes."
                            )) {
                              startTransition(() => {
                                void removeExercise(e.id);
                                setEditingId(null);
                              });
                            }
                          }}
                        />
                      </Panel>
                    ) : (
                      <button
                        onClick={() => setEditingId(e.id)}
                        className="flex w-full items-center justify-between rounded-lg border
                                   border-line bg-panel px-3 py-3 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{e.name}</span>
                          {e.notes && (
                            <span className="block truncate text-[11px] text-ink-faint">
                              {e.notes}
                            </span>
                          )}
                        </span>
                        <span className="ml-2 shrink-0 text-[11px] text-ink-faint">
                          {e.isCompound ? "compound" : ""}
                        </span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-5 text-xs text-ink-faint">
        Lifts you log as a one-off during a workout are not added here —{" "}
        <Link href="/" className="text-accent underline">start a workout</Link> and use
        New above if you want one kept.
      </p>
    </Page>
  );
}

function AddForm({
  pending, error, onSubmit, onCancel,
}: {
  pending: boolean;
  error: string | null;
  onSubmit: (name: string, muscleGroup: string, isCompound: boolean) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<string>(MUSCLE_GROUPS[0]);
  const [isCompound, setIsCompound] = useState(false);

  return (
    <div className="space-y-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Exercise name"
        className={inputClass}
      />
      <div className="flex gap-2">
        <select
          value={muscleGroup}
          onChange={(e) => setMuscleGroup(e.target.value)}
          className={inputClass}
        >
          {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <label className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border
                          border-line bg-panel-2 px-3 text-sm text-ink-dim">
          <input
            type="checkbox"
            checked={isCompound}
            onChange={(e) => setIsCompound(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Compound
        </label>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          disabled={pending || !name.trim()}
          onClick={() => onSubmit(name, muscleGroup, isCompound)}
        >
          Add
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function EditForm({
  exercise, pending, onSave, onDelete, onCancel,
}: {
  exercise: Exercise;
  pending: boolean;
  onSave: (name: string, muscleGroup: string, isCompound: boolean, notes: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(exercise.name);
  const [muscleGroup, setMuscleGroup] = useState(exercise.muscleGroup);
  const [isCompound, setIsCompound] = useState(exercise.isCompound);
  const [notes, setNotes] = useState(exercise.notes);

  return (
    <div className="space-y-2">
      <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      <div className="flex gap-2">
        <select
          value={muscleGroup}
          onChange={(e) => setMuscleGroup(e.target.value)}
          className={inputClass}
        >
          {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <label className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border
                          border-line bg-panel-2 px-3 text-sm text-ink-dim">
          <input
            type="checkbox"
            checked={isCompound}
            onChange={(e) => setIsCompound(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Compound
        </label>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Cues, setup, bar height…"
        className={`${inputClass} py-2`}
      />
      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          disabled={pending}
          onClick={() => onSave(name, muscleGroup, isCompound, notes)}
        >
          Save
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="danger" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}
