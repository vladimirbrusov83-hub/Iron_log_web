"use client";

import { useState, useTransition } from "react";
import { logBodyweight, removeBodyweight } from "@/app/actions";
import { Bar, Button, Panel, inputClass } from "@/components/ui";
import type { BodyweightEntry } from "@/lib/types";

export function BodyweightPanel({
  entries, unit,
}: { entries: BodyweightEntry[]; unit: string }) {
  const [weight, setWeight] = useState("");
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const recent = entries.slice(0, 14);
  // Scaled against the range that is actually there, not against zero — a
  // bodyweight chart anchored at 0 is a flat line.
  const values = recent.map((e) => e.weight);
  const min = Math.min(...values, Infinity);
  const max = Math.max(...values, -Infinity);
  const span = max - min || 1;

  return (
    <section className="mb-5">
      <h2 className="mb-2 text-sm font-medium text-ink-dim">Bodyweight</h2>
      <Panel>
        <form
          className="flex gap-2"
          action={() => {
            const value = Number(weight);
            if (!value) return;
            startTransition(() => {
              void logBodyweight(value, today);
              setWeight("");
            });
          }}
        >
          <input
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={`Today's weight (${unit})`}
            className={inputClass}
          />
          <Button type="submit" disabled={pending || !weight}>Log</Button>
        </form>

        {recent.length === 0 ? (
          <p className="mt-3 text-xs text-ink-faint">Nothing logged yet.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {recent.map((e) => (
              <li key={e.id} className="tnum text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-ink-dim">
                    {new Date(`${e.date}T00:00:00`).toLocaleDateString(undefined, {
                      month: "short", day: "numeric",
                    })}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span>{e.weight} {unit}</span>
                    <button
                      onClick={() => startTransition(() => { void removeBodyweight(e.id); })}
                      className="text-ink-faint"
                      aria-label={`Delete ${e.date} entry`}
                    >
                      ×
                    </button>
                  </span>
                </div>
                <div className="mt-0.5">
                  <Bar fraction={(e.weight - min) / span} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}
