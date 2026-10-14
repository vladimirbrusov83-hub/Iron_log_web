"use client";

import { secondaryOptions } from "@/lib/types";

/**
 * "Also works ½": the one muscle a lift trains besides its main one (one at
 * most — Vladimir, Oct 2026). Each set then counts as half a set, and half its
 * effective reps, for it. Optional — an isolation lift leaves it empty. Tapping
 * another chip swaps it; tapping the picked one clears it. Used by the
 * library's New and Edit forms, the picker's New exercise dialog and the gym
 * screen's ½ sheet.
 *
 * The main muscle is never offered; when it changes to one already ticked, the
 * caller drops it with `withoutPrimary`.
 */
export function SecondaryMuscles({
  primary, value, onChange,
}: { primary: string; value: string[]; onChange: (next: string[]) => void }) {
  const options = secondaryOptions(primary);
  return (
    <fieldset className="rounded-xl border border-line-2 bg-panel-2 px-3 pb-3 pt-2">
      <legend className="sr-only">Also works, at half credit</legend>
      <p className="flex items-baseline justify-between gap-2">
        <span className="eyebrow">Also works ½</span>
        <span className="text-[11px] text-ink-faint">
          {value.length === 0 ? "optional · one" : "½ set per set"}
        </span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((m) => {
          const on = value.includes(m);
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? [] : [m])}
              className={`min-h-8 rounded-full border px-2.5 text-xs ${
                on ? "border-accent bg-accent-soft text-accent" : "border-line-2 text-ink-dim"
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Drops the new main muscle from the helpers, keeping the rest. */
export function withoutPrimary(list: string[], primary: string): string[] {
  return list.filter((m) => m !== primary);
}
