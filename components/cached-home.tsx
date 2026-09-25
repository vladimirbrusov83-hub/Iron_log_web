"use client";

import { useEffect, useState } from "react";
import { ProgramCarousel } from "@/components/program-carousel";
import type { Program } from "@/lib/types";

/**
 * The home screen's program card, painted from the last visit while a cold
 * Neon wakes up.
 *
 * `RememberHome` sits inside the live block and writes what it was given;
 * `CachedHome` sits outside the Suspense boundary, so it hydrates with the page
 * shell and can read the copy straight away. (A Suspense *fallback* would not
 * do: React leaves a pending boundary's fallback as inert server HTML, so its
 * effects never run.) The live block renders before it in the DOM and
 * `[data-home-live] ~ [data-home-cached]` hides the copy the instant it lands.
 *
 * Programs only. It is the plan, not what was logged — a stale copy can at
 * worst show a day that has since been renamed, and starting it goes through
 * `startSession`, which checks the database anyway.
 */
const STORE_KEY = "ironlog.home.v1";

type Stored = { programs: Program[]; active: boolean };

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Stored;
    if (!Array.isArray(v?.programs)) return null;
    if (!v.programs.every((p) => typeof p?.id === "string" && Array.isArray(p?.days))) return null;
    return { programs: v.programs, active: !!v.active };
  } catch {
    return null; // private window, blocked storage, or an old shape
  }
}

export function RememberHome({ programs, active }: Stored) {
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ programs, active })); }
    catch { /* storage full or blocked — the next visit just waits for the server */ }
  }, [programs, active]);
  return null;
}

export function CachedHome() {
  // Read in an effect, never during render, so the server and first client paint agree.
  const [stored, setStored] = useState<Stored | null>(null);
  useEffect(() => setStored(read()), []);

  // A workout was open last time: its card would say "Continue", and a stale id
  // is worse than a blank, so hold the space instead.
  const show = stored && !stored.active && stored.programs.length > 0;

  return (
    <div data-home-cached className="mb-4">
      {show ? (
        <ProgramCarousel programs={stored.programs} />
      ) : (
        <div className="h-80 animate-pulse rounded-2xl border border-line bg-panel" />
      )}
    </div>
  );
}

/** Stands in for the three headline tiles until the live numbers arrive. */
export function TilesSkeleton() {
  return (
    <section className="mb-4 grid grid-cols-3 gap-2" aria-hidden>
      {["Eff reps · 7d", "Sessions", "Volume"].map((label) => (
        <div key={label} className="rounded-2xl border border-line bg-panel px-2.5 py-2.5">
          <div className="eyebrow truncate" style={{ fontSize: 9 }}>{label}</div>
          <div className="display tnum mt-0.5 text-2xl font-semibold text-ink-faint">–</div>
        </div>
      ))}
    </section>
  );
}
