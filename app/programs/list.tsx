"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  copyProgram, hideProgram, removeProgramFromList, reorderProgramList, togglePin,
} from "@/app/actions";
import { Button, ButtonLink } from "@/components/ui";
import { DragHandle, useDragReorder } from "@/components/drag-list";
import { SwipeDelete } from "@/components/swipe-delete";
import type { Program } from "@/lib/types";

/**
 * The Programs list: dragged into order by the handle, and each card has
 * Edit · Duplicate · Delete. The three presets cannot be deleted — they get
 * **Hide** instead, which folds the card to one line, and they do not swipe.
 * Your own programs also swipe left to Delete. Either delete asks first.
 * The ★ pinned program cannot be deleted at all — no swipe, and its Delete
 * button only says to unpin it first.
 */
export function ProgramList({ programs }: { programs: Program[] }) {
  const [list, setList] = useState(programs);
  const [swiped, setSwiped] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => { setList(programs); }, [programs]);

  const { listRef, dragging, handleProps } = useDragReorder(
    list,
    setList,
    (next) => startTransition(() => { void reorderProgramList(next.map((p) => p.id)); }),
  );

  function remove(p: Program) {
    if (p.isPinned) {
      alert(`"${p.name}" is pinned. Unpin it (★) first to delete it.`);
      return;
    }
    if (!confirm(`Delete "${p.name}"? Sessions already logged from it are kept.`)) return;
    setSwiped(null);
    setList((current) => current.filter((x) => x.id !== p.id));
    startTransition(() => { void removeProgramFromList(p.id); });
  }

  function setHidden(p: Program, hidden: boolean) {
    setList((current) => current.map((x) => (x.id === p.id ? { ...x, isHidden: hidden } : x)));
    startTransition(() => { void hideProgram(p.id, hidden); });
  }

  return (
    <ul ref={listRef} className="space-y-3">
      {list.map((p, i) => {
        const border = dragging === i
          ? "border-accent bg-panel-2"
          : `${p.isPinned ? "border-accent/40" : "border-line"} bg-panel`;
        const handle = (
          <span {...handleProps(i)} data-no-swipe className="flex self-stretch">
            <DragHandle label={`Reorder ${p.name}`} />
          </span>
        );

        if (p.isPreset && p.isHidden) {
          return (
            <li key={p.id}>
              <div className={`flex items-stretch rounded-2xl border pr-2 transition-colors ${border}`}>
                {handle}
                <p className="min-w-0 flex-1 select-none self-center truncate py-2 pl-3 text-sm text-ink-dim">
                  {p.name} <span className="text-[11px] text-ink-faint">· preset, hidden</span>
                </p>
                <button
                  onClick={() => setHidden(p, false)}
                  className="my-1.5 min-h-9 shrink-0 rounded-xl border border-line-2 px-3
                             text-xs font-semibold text-ink-dim active:bg-panel-2"
                >
                  Show
                </button>
              </div>
            </li>
          );
        }

        const sets = p.days.reduce(
          (sum, d) => sum + d.exercises.reduce((n, e) => n + e.plannedSets, 0), 0);
        const card = (
          <div className="flex items-stretch">
            {handle}
            <div className="min-w-0 flex-1 p-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/programs/${p.id}`} className="min-w-0 flex-1 select-none">
                  <h2 className="display truncate text-xl font-semibold">{p.name}</h2>
                  <p className="tnum text-[11px] text-ink-faint">
                    {p.days.length} days · {sets} planned sets a week
                    {p.isPreset && " · preset"}
                  </p>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-ink-dim">{p.description}</p>
                  )}
                </Link>
                <form action={togglePin.bind(null, p.id, p.isPinned)} data-no-swipe>
                  <button
                    className={`h-10 w-10 rounded-xl border text-base ${
                      p.isPinned
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line-2 text-ink-faint"
                    }`}
                    aria-label={p.isPinned ? "Unpin program" : "Pin to home screen"}
                    title={p.isPinned ? "Unpin" : "Pin to home screen"}
                  >
                    ★
                  </button>
                </form>
              </div>

              <div className="mt-3 flex gap-2" data-no-swipe>
                <ButtonLink href={`/programs/${p.id}`} className="flex-1 px-2">Edit</ButtonLink>
                <form action={copyProgram.bind(null, p.id)} className="flex-1">
                  <Button type="submit" className="w-full px-2">Duplicate</Button>
                </form>
                {p.isPreset ? (
                  <Button className="flex-1 px-2" onClick={() => setHidden(p, true)}>Hide</Button>
                ) : (
                  <Button
                    variant="danger"
                    className={`flex-1 px-2 ${p.isPinned ? "opacity-40" : ""}`}
                    aria-label={p.isPinned ? `Delete ${p.name} (unpin first)` : undefined}
                    onClick={() => remove(p)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        );

        return (
          <li key={p.id}>
            {p.isPreset || p.isPinned ? (
              <div className={`rounded-2xl border transition-colors ${border}`}>{card}</div>
            ) : (
              <SwipeDelete
                label={p.name}
                open={swiped === p.id}
                onOpen={(o) => setSwiped(o ? p.id : null)}
                onDelete={() => remove(p)}
                rounded="rounded-2xl"
                className={`rounded-2xl border transition-colors ${border}`}
              >
                {card}
              </SwipeDelete>
            )}
          </li>
        );
      })}
    </ul>
  );
}
