"use client";

import { useRef, useState, useTransition } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { removeSessionFromList } from "@/app/actions";

const REVEAL = 88;      // how far the row slides to park the Delete button open
const OPEN_AT = 44;     // drag past this and it snaps open instead of back
const SLOP = 8;         // px before a gesture is judged horizontal or vertical

/**
 * One history row that slides left to uncover a Delete button.
 *
 * The move/up handlers live on `window`, not on the element, and are attached
 * for the length of one gesture, so they keep arriving once the card has
 * translated out from under the finger.
 *
 * `onDragStart` is prevented because the card is a <Link>, and an <a href> is
 * natively draggable: without it the browser started a link drag two pixels
 * in, fired `pointercancel`, and the swipe died on the spot.
 *
 * Deliberately *not* `touch-action: none`, unlike `useDragReorder`: the page
 * still has to scroll under a finger that starts on a card. The axis is
 * decided on the first few pixels — more vertical than horizontal and the
 * gesture is handed straight back to the browser for the rest of the pointer
 * sequence.
 *
 * The whole card is a <Link>, so a released swipe would otherwise navigate to
 * the session it was trying to delete. `onClickCapture` eats the click when
 * the row moved at all, and when the row is open a tap closes it instead.
 *
 * Deleting is two steps — the revealed button only opens the confirm panel,
 * which says what is going. Same shape as the exercise library's delete.
 */
export function SwipeRow({
  id, label, open, onOpen, children,
}: {
  id: string;
  label: string;
  open: boolean;
  onOpen: (id: string | null) => void;
  children: ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const moved = useRef(false);

  const offset = open ? -REVEAL : 0;
  const x = dragging ? dx : offset;

  function down(e: ReactPointerEvent) {
    if (confirming || pending || e.button > 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let axis: "?" | "x" = "?";
    moved.current = false;

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
      // Rubber-band past closed on the right, and stop a little past the button.
      const next = offset + dxRaw;
      setDx(next > 0 ? next * 0.2 : Math.max(next, -REVEAL - 24));
    }

    // `touch-action: pan-y` alone is not enough: Chromium hands a horizontal
    // gesture to the scroller anyway and fires pointercancel two moves in, and
    // the swipe dies. Preventing the *touchmove* — not the pointermove, which
    // does nothing for scrolling — keeps the stream alive.
    function block(ev: TouchEvent) {
      if (axis === "x" && ev.cancelable) ev.preventDefault();
    }

    function up(ev: PointerEvent) {
      if (axis === "x") onOpen(ev.clientX - startX + offset < -OPEN_AT ? id : null);
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
    <div className="relative overflow-hidden rounded-2xl bg-panel">
      {/* The button parked under the card. */}
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${label}`}
          tabIndex={open ? 0 : -1}
          className="flex w-[88px] flex-col items-center justify-center gap-1
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
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          // A swipe ends in a click on the <Link>. Eat it — and only treat it
          // as "tap to close" when the finger did not actually move, or the
          // gesture that just opened the row would close it again.
          if (!moved.current && !open) return;
          e.preventDefault();
          e.stopPropagation();
          if (open && !moved.current) onOpen(null);
        }}
        style={{
          transform: `translate3d(${x}px,0,0)`,
          transition: dragging ? "none" : "transform 220ms ease",
          touchAction: "pan-y",
        }}
        className={`relative bg-panel ${pending ? "opacity-40" : ""}`}
      >
        {children}
      </div>

      {confirming && (
        <div className="absolute inset-0 z-10 flex flex-col justify-center gap-2
                        rounded-2xl border border-bad/30 bg-panel-2 px-4 py-3">
          <p className="text-sm">
            Delete <span className="font-medium">{label}</span>? Its sets and effective reps
            go with it.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => { setConfirming(false); onOpen(null); }}
              className="min-h-9 flex-1 rounded-xl border border-line-2 bg-panel px-3
                         text-sm font-semibold text-ink disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  // finally, so a failed delete closes the panel and leaves the
                  // row visibly still there rather than stuck on "Deleting…".
                  try { await removeSessionFromList(id); }
                  finally { setConfirming(false); onOpen(null); }
                })
              }
              className="min-h-9 flex-1 rounded-xl bg-bad px-3 text-sm font-semibold text-black
                         disabled:opacity-40"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The list. Holds which row is open, so only one Delete button shows at a time.
 * The cards themselves are still rendered on the server and handed over as
 * `card` — this component only adds the gesture around them.
 */
export function HistoryList({
  rows,
}: { rows: { id: string; label: string; card: ReactNode }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="space-y-2">
      {rows.map((row, i) => (
        <li key={row.id} className={`rise ${i < 4 ? `rise-${i}` : ""}`}>
          <SwipeRow id={row.id} label={row.label} open={open === row.id} onOpen={setOpen}>
            {row.card}
          </SwipeRow>
        </li>
      ))}
    </ul>
  );
}
