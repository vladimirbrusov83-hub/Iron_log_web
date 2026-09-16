"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addDay, removeProgram, reorderDays, saveProgramMeta } from "@/app/actions";
import { Button, Header, Page, Panel, SectionTitle, inputClass } from "@/components/ui";
import { DragHandle, useDragReorder } from "@/components/drag-list";
import { WEEKLY_SETS_FLOOR, WEEKLY_SETS_HIGH, WEEKLY_SETS_LOW } from "@/lib/targets";
import type { Program } from "@/lib/types";

/**
 * A program is a list of days and a name. Each day is edited on its own page, so
 * this one only orders them and says what the week adds up to.
 */
export function ProgramPage({ program }: { program: Program }) {
  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description);
  const [days, setDays] = useState(program.days);
  const [pending, startTransition] = useTransition();

  const { listRef, dragging, handleProps } = useDragReorder(
    days,
    setDays,
    (next) => startTransition(() => { void reorderDays(program.id, next.map((d) => d.id)); }),
  );

  const weeklySets = days.reduce(
    (sum, d) => sum + d.exercises.reduce((n, e) => n + e.plannedSets, 0), 0);

  const perMuscle = new Map<string, number>();
  for (const d of days) {
    for (const e of d.exercises) {
      perMuscle.set(e.muscleGroup, (perMuscle.get(e.muscleGroup) ?? 0) + e.plannedSets);
    }
  }

  function saveMeta() {
    if (name === program.name && description === program.description) return;
    startTransition(() => { void saveProgramMeta(program.id, name, description); });
  }

  return (
    <Page>
      <Header back={{ href: "/programs", label: "Programs" }} title="Edit program" />

      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveMeta}
          placeholder="Program name"
          aria-label="Program name"
          className={`${inputClass} display text-xl font-semibold`}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveMeta}
          placeholder="What this program is for (optional)"
          rows={2}
          className={`${inputClass} py-2 text-sm`}
        />
        <p className="text-[11px] text-ink-faint">The name saves as you leave the box.</p>
      </div>

      <div className="mt-5">
        <SectionTitle>Days</SectionTitle>
        {days.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-2 px-4 py-8 text-center
                        text-sm text-ink-faint">
            No days yet. Add one below.
          </p>
        ) : (
          <ul ref={listRef} className="space-y-2">
            {days.map((day, i) => (
              <li
                key={day.id}
                className={`flex items-center gap-1 rounded-2xl border bg-panel pr-2
                            transition-colors ${
                  dragging === i ? "border-accent bg-panel-2" : "border-line"
                }`}
              >
                <span {...handleProps(i)}><DragHandle label={`Reorder ${day.name}`} /></span>
                <Link href={`/programs/${program.id}/days/${day.id}`} className="min-w-0 flex-1 py-3">
                  <span className="display block truncate text-xl font-semibold">{day.name}</span>
                  <span className="block truncate text-[11px] text-ink-faint">
                    {day.exercises.length === 0
                      ? "empty"
                      : `${day.exercises.length} lifts · ${day.exercises.map((e) => e.name).join(" · ")}`}
                  </span>
                </Link>
                <span className="shrink-0 text-accent">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form action={addDay.bind(null, program.id, `Day ${days.length + 1}`)} className="mt-2">
          <Button type="submit" className="w-full">+ Add day</Button>
        </form>
      </div>

      {perMuscle.size > 0 && (
        <Panel className="mt-5">
          <p className="eyebrow">Planned sets a week</p>
          <p className="tnum mt-1 text-sm text-ink-dim">
            {days.length} day{days.length === 1 ? "" : "s"} · {weeklySets} sets
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {[...perMuscle.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([muscle, n]) => (
                <li
                  key={muscle}
                  className={`rounded-lg border px-2 py-1 text-xs ${
                    n >= WEEKLY_SETS_LOW && n <= WEEKLY_SETS_HIGH
                      ? "border-good/40 text-good"
                      : n < WEEKLY_SETS_FLOOR ? "border-bad/40 text-bad" : "border-line-2 text-ink-dim"
                  }`}
                >
                  {muscle} <span className="display text-sm font-semibold">{n}</span>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            Green: {WEEKLY_SETS_LOW}–{WEEKLY_SETS_HIGH} sets a week, the productive range.
            Red: under the {WEEKLY_SETS_FLOOR}-set floor. Planned, not performed — hard sets
            are counted after the fact on Stats.
          </p>
        </Panel>
      )}

      <Button
        variant="danger"
        className="mt-5 w-full"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${program.name}"? Sessions already logged from it are kept.`)) {
            startTransition(() => { void removeProgram(program.id); });
          }
        }}
      >
        Delete program
      </Button>
    </Page>
  );
}
