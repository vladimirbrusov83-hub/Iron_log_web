"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

const REVEAL = 80;      // how far the row slides to park the Delete button open
const OPEN_AT = 40;     // drag past this and it snaps open instead of back
const SLOP = 8;         // px before a gesture is judged horizontal or vertical

/**
 * A row that slides left to uncover a Delete button — the program day editor's
 * version of the history screen's `SwipeRow`, same gesture, no confirm step.
 * Removing a lift from a day is only a change to the draft until **Save day**,
 * so one tap on the button is enough.
 *
 * Anything marked `data-no-swipe` (the drag handle, the fields) keeps its own
 * pointer handling: a press that starts there never becomes a swipe.
 */
export function SwipeDelete({
  label, open, onOpen, onDelete, className = "", children,
}: {
  label: string;
  open: boolean;
  onOpen: (open: boolean) => void;
  onDelete: () => void;
  className?: string;
  children: ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const moved = useRef(false);

  const offset = open ? -REVEAL : 0;
  const x = dragging ? dx : offset;

  function down(e: ReactPointerEvent) {
    moved.current = false;
    if (e.button > 0) return;
    if ((e.target as Element).closest("[data-no-swipe]")) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let axis: "?" | "x" = "?";

    function move(ev: PointerEvent) {
      const dxRaw = ev.clientX - startX;
      const dyRaw = ev.clientY - startY;
      if (axis === "?") {
        if (Math.abs(dxRaw) < SLOP && Math.abs(dyRaw) < SLOP) return;
        // Vertical wins: it is a scroll, and this gesture is over for us.
        if (Math.abs(dyRaw) > Math.abs(dxRaw)) return end();
        axis = "x";
        setDragging(true);
      }
      moved.current = true;
      const next = offset + dxRaw;
      setDx(next > 0 ? next * 0.2 : Math.max(next, -REVEAL - 24));
    }

    // Same trap as SwipeRow: without preventing touchmove, Chromium hands the
    // horizontal gesture to the scroller and fires pointercancel.
    function block(ev: TouchEvent) {
      if (axis === "x" && ev.cancelable) ev.preventDefault();
    }

    function up(ev: PointerEvent) {
      if (axis === "x") onOpen(ev.clientX - startX + offset < -OPEN_AT);
      end();
    }

    function end() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("touchmove", block);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", end);
      setDragging(false);
      setDx(0);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("touchmove", block, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", end);
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Remove ${label}`}
          tabIndex={open ? 0 : -1}
          className="flex w-[80px] flex-col items-center justify-center gap-1
                     bg-bad/15 text-bad active:bg-bad/25"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
          <span className="eyebrow" style={{ fontSize: 9 }}>Delete</span>
        </button>
      </div>

      <div
        onPointerDown={down}
        onClickCapture={(e) => {
          // A swipe ends in a click on whatever was under the finger. Eat it,
          // and when the row is open a plain tap closes it instead.
          if (!moved.current && !open) return;
          e.preventDefault();
          e.stopPropagation();
          if (open && !moved.current) onOpen(false);
        }}
        style={{
          transform: `translate3d(${x}px,0,0)`,
          transition: dragging ? "none" : "transform 220ms ease",
          touchAction: "pan-y",
        }}
        className={`relative ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
