"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";

const STORE_KEY = "ironlog.stats.timeWindow";

/**
 * Days and time trained for one window at a time, picked by chip. Every window
 * is computed on the server; the pick only chooses which to show, and is
 * remembered on this phone only.
 */
export function TrainingTime({
  windows,
}: { windows: { label: string; days: number; time: string }[] }) {
  const [picked, setPicked] = useState(0);

  useEffect(() => {
    try {
      const i = windows.findIndex((w) => w.label === localStorage.getItem(STORE_KEY));
      if (i >= 0) setPicked(i);
    } catch { /* storage blocked — stay on the first */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(i: number) {
    setPicked(i);
    try { localStorage.setItem(STORE_KEY, windows[i].label); } catch { /* ignore */ }
  }

  const w = windows[picked];
  return (
    <Panel className="!p-3">
      <div className="grid grid-cols-5 gap-1">
        {windows.map((x, i) => (
          <button
            key={x.label}
            onClick={() => pick(i)}
            className={`display min-h-9 rounded-lg border text-sm font-semibold ${
              i === picked
                ? "border-accent bg-accent text-black"
                : "border-line-2 bg-panel-2 text-ink-dim"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="tnum mt-2 flex items-baseline justify-around">
        <div className="text-center">
          <span className="display text-2xl font-semibold">{w.days}</span>
          <span className="ml-1 text-xs text-ink-faint">day{w.days === 1 ? "" : "s"}</span>
        </div>
        <div className="text-center">
          <span className="display text-2xl font-semibold text-accent">{w.time}</span>
          <span className="ml-1 text-xs text-ink-faint">trained</span>
        </div>
      </div>
    </Panel>
  );
}
