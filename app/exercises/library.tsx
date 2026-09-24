"use client";

import { useState, useTransition } from "react";
import { createExercise, editExercise, removeExercise } from "@/app/actions";
import { Button, Empty, Header, Page, Panel, inputClass } from "@/components/ui";
import { MUSCLE_GROUPS } from "@/lib/types";
import type { ExerciseUsage } from "@/lib/db";
import type { Exercise } from "@/lib/types";

/**
 * The exercise base: everything the pickers offer, and the only place lifts are
 * removed.
 *
 * Every row carries how much it is actually used, and "Unused" is a filter of
 * its own, because the thing this page is really for is finding the typo you
 * saved in a hurry from a picker and getting rid of it.
 */
export function Library({
  exercises, usage,
}: { exercises: Exercise[]; usage: Record<string, ExerciseUsage> }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const used = (e: Exercise) => (usage[e.id]?.programs ?? 0) + (usage[e.id]?.sessions ?? 0) > 0;

  const matches = exercises.filter((e) =>
    (q === "" || e.name.toLowerCase().includes(q))
    && (group === null || e.muscleGroup === group)
    && (!onlyUnused || !used(e)));

  const groups = MUSCLE_GROUPS.filter((m) => exercises.some((e) => e.muscleGroup === m));
  const unusedCount = exercises.filter((e) => !used(e)).length;

  const byGroup = new Map<string, Exercise[]>();
  for (const e of matches) byGroup.set(e.muscleGroup, [...(byGroup.get(e.muscleGroup) ?? []), e]);

  return (
    <Page>
      <Header
        back={{ href: "/settings", label: "More" }}
        title="Exercise library"
        subtitle={`${exercises.length} lifts${unusedCount > 0 ? ` · ${unusedCount} unused` : ""}`}
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>New</Button>
        }
      />

      {/* Search and the muscle chips stay pinned to the top while the list
          scrolls under them. */}
      <div
        className="sticky top-0 z-20 -mx-4 mb-4 border-b border-line bg-bg/90 px-4 pb-2 pt-2
                   backdrop-blur-md"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
      >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name"
        className={inputClass}
      />

      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]
                      [&::-webkit-scrollbar]:hidden">
        {[null, ...groups].map((g) => (
          <button
            key={g ?? "all"}
            onClick={() => { setGroup(g); setOnlyUnused(false); }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
              group === g && !onlyUnused
                ? "border-accent bg-accent-soft text-accent"
                : "border-line-2 text-ink-dim"
            }`}
          >
            {g ?? "All"}
          </button>
        ))}
        {unusedCount > 0 && (
          <button
            onClick={() => { setOnlyUnused((v) => !v); setGroup(null); }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
              onlyUnused ? "border-warn bg-warn/10 text-warn" : "border-line-2 text-ink-dim"
            }`}
          >
            Unused {unusedCount}
          </button>
        )}
      </div>
      </div>

      {matches.length === 0 ? (
        <Empty>
          {exercises.length === 0
            ? <>The library is empty. Run <code>npm run db:push</code>, or add one above.</>
            : onlyUnused ? "Everything in the library is used somewhere."
            : "Nothing matches."}
        </Empty>
      ) : (
        <div className="space-y-5">
          {[...byGroup.entries()].map(([groupName, list]) => (
            <section key={groupName}>
              <h2 className="eyebrow mb-2">{groupName}</h2>
              <ul className="space-y-1.5">
                {list.map((e) => (
                  <li key={e.id}>
                    {editingId === e.id ? (
                      <Panel>
                        <EditForm
                          exercise={e}
                          usage={usage[e.id] ?? { programs: 0, sessions: 0 }}
                          onDone={() => setEditingId(null)}
                        />
                      </Panel>
                    ) : (
                      <Row
                        exercise={e}
                        usage={usage[e.id] ?? { programs: 0, sessions: 0 }}
                        onOpen={() => setEditingId(e.id)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-5 text-xs leading-relaxed text-ink-faint">
        Deleting a lift here removes it from the library only. Sessions you have already
        logged keep it by name and still read correctly, and any program that plans it keeps
        the name too.
      </p>

      {adding && <AddDialog onClose={() => setAdding(false)} />}
    </Page>
  );
}

function usageLabel(usage: ExerciseUsage): string {
  const parts: string[] = [];
  if (usage.programs > 0) parts.push(`${usage.programs} program${usage.programs === 1 ? "" : "s"}`);
  if (usage.sessions > 0) parts.push(`${usage.sessions} session${usage.sessions === 1 ? "" : "s"}`);
  return parts.length === 0 ? "unused" : parts.join(" · ");
}

function Row({
  exercise, usage, onOpen,
}: { exercise: Exercise; usage: ExerciseUsage; onOpen: () => void }) {
  const unused = usage.programs + usage.sessions === 0;
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel
                 px-3 py-3 text-left active:bg-panel-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{exercise.name}</span>
        <span className={`tnum block truncate text-[11px] ${unused ? "text-warn" : "text-ink-faint"}`}>
          {usageLabel(usage)}
          {exercise.isCompound && <span className="text-ink-faint"> · compound</span>}
        </span>
        {exercise.notes && (
          <span className="block truncate text-[11px] text-ink-faint">{exercise.notes}</span>
        )}
      </span>
      <span className="shrink-0 text-ink-faint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  );
}

/* --------------------------------------------------------------- add */

function AddDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<string>(MUSCLE_GROUPS[0]);
  const [isCompound, setIsCompound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await createExercise(trimmed, muscleGroup, isCompound);
      if (result?.ok) onClose();
      else setError(result?.error ?? "Could not add that.");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-line-2 bg-panel p-4">
        <h3 className="display text-2xl font-semibold">New exercise</h3>
        <p className="mt-0.5 text-[11px] text-ink-faint">
          Available in every picker afterwards.
        </p>

        <input
          autoFocus
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) submit(); }}
          placeholder="Exercise name"
          aria-label="Exercise name"
          className={`${inputClass} mt-3`}
        />

        <div className="mt-2 flex gap-2">
          <select
            value={muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value)}
            className={inputClass}
            aria-label="Muscle group"
          >
            {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <label className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border
                            border-line-2 bg-panel-2 px-3 text-sm text-ink-dim">
            <input
              type="checkbox"
              checked={isCompound}
              onChange={(e) => setIsCompound(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Compound
          </label>
        </div>

        {error && <p className="mt-2 text-sm text-bad">{error}</p>}

        <div className="mt-3 flex gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={pending || !name.trim()}
            onClick={submit}
          >
            {pending ? "Adding…" : "Add exercise"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- edit */

function EditForm({
  exercise, usage, onDone,
}: { exercise: Exercise; usage: ExerciseUsage; onDone: () => void }) {
  const [name, setName] = useState(exercise.name);
  const [muscleGroup, setMuscleGroup] = useState(exercise.muscleGroup);
  const [isCompound, setIsCompound] = useState(exercise.isCompound);
  const [notes, setNotes] = useState(exercise.notes);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Name"
        className={inputClass}
      />
      <div className="flex gap-2">
        <select
          value={muscleGroup}
          onChange={(e) => setMuscleGroup(e.target.value)}
          className={inputClass}
          aria-label="Muscle group"
        >
          {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <label className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border
                          border-line-2 bg-panel-2 px-3 text-sm text-ink-dim">
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
        className={`${inputClass} py-2 text-sm`}
      />

      <p className="tnum text-[11px] text-ink-faint">Used in {usageLabel(usage)}.</p>

      {confirming ? (
        <div className="rounded-xl border border-bad/40 bg-bad/5 p-3">
          <p className="text-sm">
            Delete <span className="font-medium">{exercise.name}</span> from the library?
          </p>
          <p className="mt-1 text-[11px] leading-snug text-ink-faint">
            {usage.sessions > 0
              ? `${usage.sessions} logged session${usage.sessions === 1 ? "" : "s"} keep it by name and still read correctly. `
              : "Nothing has been logged with it. "}
            {usage.programs > 0
              ? `${usage.programs} program${usage.programs === 1 ? " keeps" : "s keep"} it too. `
              : ""}
            It only stops appearing in the pickers.
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => setConfirming(false)}>Keep it</Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={pending}
              onClick={() => startTransition(() => { void removeExercise(exercise.id); onDone(); })}
            >
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            disabled={pending || !name.trim()}
            onClick={() => startTransition(() => {
              void editExercise(exercise.id, name.trim(), muscleGroup, isCompound, notes);
              onDone();
            })}
          >
            Save
          </Button>
          <Button onClick={onDone}>Cancel</Button>
          <Button variant="danger" onClick={() => setConfirming(true)}>Delete</Button>
        </div>
      )}
    </div>
  );
}
