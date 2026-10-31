"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * Pages swiped sideways under a row of named tabs: the home drawer's this week
 * and last week. Same native scroll-snap as ProgramCarousel; the only script reads
 * which page the scroll settled on and scrolls to a tapped tab. The pages are
 * built on the server and passed in.
 */
export function WeekCarousel({ pages }: { pages: { label: string; content: ReactNode }[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function onScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const page = Math.round(track.scrollLeft / track.clientWidth);
    setIndex(Math.max(0, Math.min(pages.length - 1, page)));
  }

  function goTo(i: number) {
    const track = trackRef.current;
    if (track) track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-1 px-4 pt-3">
        {pages.map((p, i) => (
          <button
            key={p.label}
            onClick={() => goTo(i)}
            aria-current={i === index ? "true" : undefined}
            className={`display min-h-11 rounded-lg border text-sm font-semibold ${
              i === index
                ? "border-accent bg-accent text-black"
                : "border-line-2 bg-panel-2 text-ink-dim"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory items-start overflow-x-auto
                   [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((p) => (
          <div key={p.label} className="w-full shrink-0 snap-center px-4 py-3">
            {p.content}
          </div>
        ))}
      </div>
    </>
  );
}
