"use client";

import { useState, useTransition } from "react";
import { createExercise } from "@/app/actions";
import { Button, inputClass } from "@/components/ui";
import { MUSCLE_GROUPS } from "@/lib/types";
import type { Exercise } from "@/lib/types";

/**
 * Adds lifts to a day.
 *
 * Three things it has to do that the old one-tap-one-lift version did not:
 * filter by muscle group, take several lifts in a single visit, and create a
 * lift that is not in the library yet — which then arrives selected, so it goes
 * into the day without being searched for a second time.
 */
export function ExercisePicker({
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
  // "Seal Row", "seal-row" and "Seal  Row" are the same lift. The unique index
  // only catches the case difference, so the near-miss is caught here instead of
  // quietly becoming a second entry.
  const flatten = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const similar = newName.trim() === ""
    ? undefined
    : library.find((e) => flatten(e.name) === flatten(newName));
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
                Goes into the library for good, and into this day. Remove it later under
                More → Exercise library.
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

              {similar && (
                <div className="mt-2 rounded-xl border border-warn/40 bg-warn/5 p-2.5">
                  <p className="text-xs text-warn">
                    <span className="font-medium">{similar.name}</span> is already in the
                    library.
                  </p>
                  <Button
                    className="mt-2 w-full text-xs"
                    onClick={() => {
                      setChosen((current) => current.some((c) => c.id === similar.id)
                        ? current : [...current, similar]);
                      setCreating(false);
                      setNewName("");
                      setQuery("");
                    }}
                  >
                    Use {similar.name} instead
                  </Button>
                </div>
              )}

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
