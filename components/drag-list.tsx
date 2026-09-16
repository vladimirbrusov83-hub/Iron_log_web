"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Drag-to-reorder for a vertical list, on a phone.
 *
 * Built on pointer events rather than HTML5 drag-and-drop, which does not exist
 * on touch at all. The handle captures the pointer, so the drag keeps working
 * even when the finger leaves the row it started on, and `touch-action: none`
 * on the handle stops the page scrolling underneath it.
 *
 * The list reorders live as you cross a neighbour rather than on drop, so what
 * you see while dragging is what you get when you let go. `onSettle` fires once
 * at the end, which is where a save belongs — not on every crossing.
 *
 * Selection is suppressed on the whole document for the length of the drag.
 * Without it a drag that starts anywhere near the text selects it — on iOS with
 * the magnifier and the copy/paste bubble on top — and the row moves under a
 * blue highlight. `select-none` on the handle alone is not enough, because the
 * pointer leaves the handle as soon as the drag begins.
 */
export function useDragReorder<T>(
  items: T[],
  onReorder: (next: T[]) => void,
  onSettle?: (next: T[]) => void,
) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const drag = useRef<{ index: number } | null>(null);
  // Held in a ref because the pointer handlers outlive the render that made them.
  const latest = useRef(items);
  useEffect(() => { latest.current = items; }, [items]);

  function down(index: number, event: ReactPointerEvent) {
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    document.body.style.setProperty("user-select", "none");
    document.body.style.setProperty("-webkit-user-select", "none");
    drag.current = { index };
    setDragging(index);
  }

  function move(event: ReactPointerEvent) {
    const current = drag.current;
    const list = listRef.current;
    if (!current || !list) return;

    const rows = Array.from(list.children) as HTMLElement[];
    const y = event.clientY;
    let target = current.index;
    for (let i = 0; i < rows.length; i++) {
      const box = rows[i].getBoundingClientRect();
      if (y >= box.top && y <= box.bottom) { target = i; break; }
      if (i === 0 && y < box.top) target = 0;
      if (i === rows.length - 1 && y > box.bottom) target = rows.length - 1;
    }
    if (target === current.index) return;

    const next = [...latest.current];
    const [moved] = next.splice(current.index, 1);
    next.splice(target, 0, moved);
    current.index = target;
    setDragging(target);
    latest.current = next;
    onReorder(next);
  }

  function up() {
    if (drag.current) onSettle?.(latest.current);
    drag.current = null;
    setDragging(null);
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("-webkit-user-select");
  }

  // A drag interrupted by a tab switch or a phone call would otherwise leave the
  // page unselectable for good.
  useEffect(() => () => {
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("-webkit-user-select");
  }, []);

  return {
    listRef,
    dragging,
    handleProps: (index: number) => ({
      onPointerDown: (e: ReactPointerEvent) => down(index, e),
      onPointerMove: move,
      onPointerUp: up,
      onPointerCancel: up,
      style: { touchAction: "none" as const },
    }),
  };
}

/**
 * The grip. A full-height column of its own, set apart from the text by a rule,
 * so a thumb aiming for it cannot land on the lift name instead — which is how
 * a drag turned into a text selection.
 */
export function DragHandle({ label = "Reorder" }: { label?: string }) {
  return (
    <span
      aria-label={label}
      className="-my-px flex h-full min-h-14 w-11 shrink-0 select-none items-center
                 justify-center self-stretch rounded-l-xl border-r border-line
                 text-ink-faint active:bg-panel-2 active:text-accent
                 [-webkit-touch-callout:none]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="9" cy="6" r="1.7" /><circle cx="15" cy="6" r="1.7" />
        <circle cx="9" cy="12" r="1.7" /><circle cx="15" cy="12" r="1.7" />
        <circle cx="9" cy="18" r="1.7" /><circle cx="15" cy="18" r="1.7" />
      </svg>
    </span>
  );
}
