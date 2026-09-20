"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Where the running rest lives so it survives a navigation. */
const STORE_KEY = "ironlog.rest";

function readStored(): { endsAt: number; seconds: number } | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { endsAt?: unknown; seconds?: unknown };
    if (typeof v.endsAt !== "number" || typeof v.seconds !== "number") return null;
    // An expired rest is not worth restoring — it would land on "Go" from a
    // countdown that finished while another screen was open.
    if (v.endsAt <= Date.now()) { localStorage.removeItem(STORE_KEY); return null; }
    return { endsAt: v.endsAt, seconds: v.seconds };
  } catch { return null; }
}

/**
 * Rest countdown.
 *
 * Remaining time is derived from a stored end timestamp on every tick, never
 * decremented. A phone that locks mid-set throttles or stops `setInterval`, and
 * a counter that subtracts one per tick comes back minutes wrong; reading the
 * clock each time comes back right.
 *
 * That end timestamp is also mirrored into `localStorage`, because the gym is
 * now two screens — the exercise list and one lift — and walking back to check
 * the session total mid-rest unmounts this component. React state would drop
 * the rest on the way; the stored clock is picked straight back up.
 *
 * The alert is a Web Audio beep plus `navigator.vibrate` where it exists — iOS
 * Safari has no haptics and ignores vibrate, so the beep has to carry it alone.
 * Both fire only after a tap has unlocked audio, which starting the timer is.
 *
 * `autoStartKey` changes every time a set is ticked off; the timer restarts on
 * the default length when it does. Ticking the set is the tap that unlocks
 * audio, so the beep still fires.
 */
export function RestTimer({
  defaultSeconds, autoStartKey = 0,
}: { defaultSeconds: number; autoStartKey?: number }) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [seconds, setSeconds] = useState(defaultSeconds);
  const audioRef = useRef<AudioContext | null>(null);
  const firedRef = useRef(false);
  const lastKey = useRef(autoStartKey);

  const unlockAudio = useCallback(() => {
    try {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) { audioRef.current = audioRef.current ?? new Ctor(); void audioRef.current.resume(); }
    } catch { /* no audio on this device; the on-screen countdown still works */ }
  }, []);

  const beep = useCallback(() => {
    try {
      const ctx = audioRef.current;
      if (!ctx) return;
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
    } catch { /* see unlockAudio */ }
    navigator.vibrate?.([120, 80, 120]);
  }, []);

  const start = useCallback((forSeconds: number) => {
    firedRef.current = false;
    const at = Date.now() + forSeconds * 1000;
    setSeconds(forSeconds);
    setEndsAt(at);
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ endsAt: at, seconds: forSeconds })); }
    catch { /* private mode; the timer still runs for this screen */ }
    unlockAudio();
  }, [unlockAudio]);

  const stop = useCallback(() => {
    setEndsAt(null);
    setRemaining(0);
    firedRef.current = false;
    try { localStorage.removeItem(STORE_KEY); } catch { /* see start */ }
  }, []);

  // Pick up a rest already running from the other gym screen. Read after mount,
  // never during render, so the server and the first client paint agree.
  useEffect(() => {
    const stored = readStored();
    if (stored) { setSeconds(stored.seconds); setEndsAt(stored.endsAt); }
  }, []);

  useEffect(() => {
    if (autoStartKey !== lastKey.current) {
      lastKey.current = autoStartKey;
      start(defaultSeconds);
    }
  }, [autoStartKey, defaultSeconds, start]);

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

  const running = endsAt !== null && remaining > 0;
  const done = endsAt !== null && remaining === 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const fraction = seconds > 0 ? remaining / seconds : 0;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-3 transition-colors ${
        running ? "border-accent/50 bg-panel" : done ? "border-good/50 bg-panel" : "border-line bg-panel"
      }`}
    >
      {running && (
        <div
          className="absolute inset-y-0 left-0 bg-accent/10 transition-[width] duration-200"
          style={{ width: `${fraction * 100}%` }}
        />
      )}
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`display tnum text-4xl font-semibold ${done ? "text-good" : ""}`}>
            {endsAt === null ? "—:——" : `${mins}:${String(secs).padStart(2, "0")}`}
          </div>
          <div className="eyebrow">{done ? "Go" : "Rest"}</div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {[60, 90, 120, 180].map((s) => (
            <button
              key={s}
              onClick={() => start(s)}
              className={`display min-h-9 min-w-10 rounded-lg border px-2 text-sm font-semibold ${
                running && seconds === s
                  ? "border-accent text-accent"
                  : "border-line-2 bg-panel-2 text-ink-dim"
              }`}
            >
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
          {endsAt !== null && (
            <button
              onClick={stop}
              className="min-h-9 rounded-lg border border-line px-2.5 text-xs text-ink-faint"
              aria-label="Stop timer"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
