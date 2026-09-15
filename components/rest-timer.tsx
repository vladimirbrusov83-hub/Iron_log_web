"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Rest countdown.
 *
 * Remaining time is derived from a stored end timestamp on every tick, never
 * decremented. A phone that locks mid-set throttles or stops `setInterval`, and
 * a counter that subtracts one per tick comes back minutes wrong; reading the
 * clock each time comes back right.
 *
 * The alert is a Web Audio beep plus `navigator.vibrate` where it exists — iOS
 * Safari has no haptics and ignores vibrate, so the beep has to carry it alone.
 * Both fire only after a tap has unlocked audio, which starting the timer is.
 */
export function RestTimer({ defaultSeconds }: { defaultSeconds: number }) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [seconds, setSeconds] = useState(defaultSeconds);
  const audioRef = useRef<AudioContext | null>(null);
  const firedRef = useRef(false);

  const beep = useCallback(() => {
    try {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = audioRef.current ?? new Ctor();
      audioRef.current = ctx;
      void ctx.resume();
      // Three short pips rather than one long tone — audible over gym noise and
      // over headphones without being a siren.
      [0, 0.22, 0.44].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const start = ctx.currentTime + offset;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch {
      // No audio on this device or the context was blocked. The timer still
      // reaches zero on screen, which is the part that has to work.
    }
    navigator.vibrate?.([120, 80, 120]);
  }, []);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        beep();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    // Coming back from a locked screen, the interval may not have run for
    // minutes. Recomputing on visibility change makes the jump instant.
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [endsAt, beep]);

  function start(forSeconds: number) {
    firedRef.current = false;
    setSeconds(forSeconds);
    setEndsAt(Date.now() + forSeconds * 1000);
    // Created inside the tap so iOS treats audio as user-initiated; without
    // this the beep at zero is silently dropped.
    try {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) { audioRef.current = audioRef.current ?? new Ctor(); void audioRef.current.resume(); }
    } catch { /* see beep() */ }
  }

  const running = endsAt !== null && remaining > 0;
  const done = endsAt !== null && remaining === 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">Rest</div>
          <div className={`tnum text-2xl font-semibold ${done ? "text-good" : ""}`}>
            {endsAt === null ? "—" : `${mins}:${String(secs).padStart(2, "0")}`}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {[60, 90, 120, 180, 300].map((s) => (
            <button
              key={s}
              onClick={() => start(s)}
              className={`min-h-9 rounded-lg border px-2.5 text-xs font-medium ${
                running && seconds === s
                  ? "border-accent text-accent"
                  : "border-line bg-panel-2 text-ink-dim"
              }`}
            >
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
          {endsAt !== null && (
            <button
              onClick={() => { setEndsAt(null); setRemaining(0); firedRef.current = false; }}
              className="min-h-9 rounded-lg border border-line px-2.5 text-xs text-ink-faint"
            >
              Stop
            </button>
          )}
        </div>
      </div>
      {running && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-panel-2">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${(remaining / seconds) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
