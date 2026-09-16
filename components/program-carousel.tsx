"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { startWorkout } from "@/app/actions";
import type { Program } from "@/lib/types";

/**
 * The home screen's program card, one program per page, swiped sideways.
 *
 * The swipe is native scroll-snap rather than a gesture handler: momentum,
 * rubber-banding and mid-swipe reversal all come free and behave the way the
 * rest of the phone does. The only script here is the one that reads which page
 * the scroll has settled on, so the dots and the Start link know which program
 * is showing.
 *
 * Programs arrive most-recently-trained first, so the card opens on the one
 * being run without anyone choosing it.
 *
 * The card is a fixed height whatever the program, so nothing below it moves
 * when you swipe. A program with more days than fit scrolls its list inside.
 */
export function ProgramCarousel({ programs }: { programs: Program[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const current = programs[Math.min(index, programs.length - 1)] ?? programs[0];
  if (!current) return null;

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const page = Math.round(track.scrollLeft / track.clientWidth);
    setIndex(Math.max(0, Math.min(programs.length - 1, page)));
  }

  function goTo(i: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex h-80 snap-x snap-mandatory overflow-x-auto overflow-y-hidden
                   [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {programs.map((program) => (
          <section key={program.id} className="flex h-full w-full shrink-0 snap-center flex-col">
            <div className="flex items-baseline justify-between gap-2 px-4 pt-4">
              <div className="min-w-0">
                <p className="eyebrow text-accent">Start a workout</p>
                <h2 className="display mt-0.5 truncate text-3xl font-semibold">{program.name}</h2>
              </div>
              <Link href="/programs" className="shrink-0 text-xs text-accent">Edit</Link>
            </div>

            {program.days.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-faint">
                This program has no days yet.
              </p>
            ) : (
              /* Scrolls inside the fixed card when a program has more days than
                 fit, so the card never changes height. */
              <ul className="mt-3 flex-1 space-y-2 overflow-y-auto px-4 pb-4
                             [-ms-overflow-style:none] [scrollbar-width:none]
                             [&::-webkit-scrollbar]:hidden">
                {program.days.map((day, i) => (
                  <li key={day.id}>
                    <form action={startWorkout.bind(null, day.id)}>
                      <button
                        className="group flex min-h-16 w-full items-center gap-3 rounded-xl border
                                   border-line-2 bg-panel-2 px-3 text-left transition-colors
                                   hover:border-accent/60 active:bg-panel-3"
                      >
                        <span className="display tnum w-7 shrink-0 text-2xl font-semibold text-ink-faint">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="display block truncate text-xl font-semibold">
                            {day.name}
                          </span>
                          <span className="block truncate text-[11px] text-ink-faint">
                            {day.exercises.length} lifts ·{" "}
                            {day.exercises.map((e) => e.name).join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-accent">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                               strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {programs.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {programs.map((program, i) => (
            <button
              key={program.id}
              onClick={() => goTo(i)}
              aria-label={`Show ${program.name}`}
              aria-current={i === index ? "true" : undefined}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-accent" : "w-1.5 bg-line-2"
              }`}
            />
          ))}
        </div>
      )}

      {/* The way in when you have not decided which day yet. */}
      <Link
        href={`/start?program=${current.id}`}
        className="mt-3 flex min-h-14 items-center justify-center gap-2 bg-accent text-base
                   font-semibold text-black transition-colors hover:bg-[#ff7d3d] active:bg-[#e85c14]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
        Start
      </Link>
    </div>
  );
}
