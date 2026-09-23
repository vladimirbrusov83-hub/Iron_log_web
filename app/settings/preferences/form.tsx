"use client";

import { useState, useTransition } from "react";
import { saveSettings } from "@/app/actions";
import { Panel } from "@/components/ui";
import type { Settings, WeightUnit } from "@/lib/types";
import { THEMES, THEME_COLOR, THEME_COOKIE, type Theme } from "@/lib/theme";

export function SettingsForm({ settings, theme: initialTheme }: { settings: Settings; theme: Theme }) {
  const [draft, setDraft] = useState(settings);
  const [theme, setTheme] = useState(initialTheme);

  // Applied on the spot and remembered in a cookie for a year; the layout reads
  // the cookie so every later page is painted in it from the first frame.
  function chooseTheme(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[next]);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function update(change: Partial<Settings>) {
    const next = { ...draft, ...change };
    setDraft(next);
    setSaved(false);
    startTransition(async () => {
      await saveSettings(next);
      setSaved(true);
    });
  }

  return (
    <Panel className="space-y-4">
      <div>
        <div className="text-sm">Theme</div>
        <p className="mb-2 text-[11px] text-ink-faint">Saved on this device.</p>
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => chooseTheme(t)}
              className={`min-h-11 flex-1 rounded-lg border text-sm capitalize ${
                theme === t
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-panel-2 text-ink-dim"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm">Weight unit</div>
        <p className="mb-2 text-[11px] text-ink-faint">
          A label, not a conversion — changing it does not rewrite numbers already logged.
        </p>
        <div className="flex gap-2">
          {(["kg", "lb"] as WeightUnit[]).map((unit) => (
            <button
              key={unit}
              onClick={() => update({ weightUnit: unit })}
              className={`min-h-11 flex-1 rounded-lg border text-sm ${
                draft.weightUnit === unit
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-panel-2 text-ink-dim"
              }`}
            >
              {unit}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm">Default rest</div>
        <p className="mb-2 text-[11px] text-ink-faint">
          Which preset the rest timer opens on.
        </p>
        <div className="flex flex-wrap gap-2">
          {[60, 90, 120, 180, 300].map((s) => (
            <button
              key={s}
              onClick={() => update({ defaultRestSeconds: s })}
              className={`min-h-11 flex-1 rounded-lg border px-2 text-sm ${
                draft.defaultRestSeconds === s
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-panel-2 text-ink-dim"
              }`}
            >
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm">Rate sets with RIR</span>
            <span className="block text-[11px] text-ink-faint">
              Turning this off hides the RIR box in the gym. Nothing new can be scored
              while it is off, and effective reps already recorded are kept.
            </span>
          </span>
          <input
            type="checkbox"
            checked={draft.trackRir}
            onChange={(e) => update({ trackRir: e.target.checked })}
            className="h-6 w-6 shrink-0 accent-[var(--accent)]"
          />
        </label>
      </div>

      <p className="text-[11px] text-ink-faint">
        {pending ? "Saving…" : saved ? "Saved." : "Changes save as you make them."}
      </p>
    </Panel>
  );
}
