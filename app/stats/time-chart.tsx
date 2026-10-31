"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import type { TrainingDay } from "@/lib/db";

const STORE_KEY = "ironlog.stats.timeChart";
const RANGES = ["Week", "Month", "Year", "All"] as const;
type Range = (typeof RANGES)[number];

/** Past this many months "All" draws years, or the bars get too thin to label. */
const MAX_MONTH_BARS = 24;
/** Tallest bar in px. The chart is taller by the room its label needs. */
const BAR_MAX = 92;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Bar = { key: string; label: string; seconds: number; sessions: number };

// Dates stay "YYYY-MM-DD" strings and are worked on in UTC, so the phone's own
// time zone can never shift a day. The strings come from the server in TRAINING_TZ.
const toUTC = (date: string) => new Date(`${date}T00:00:00Z`);
const toDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const mondayOf = (d: Date) => addDays(d, -((d.getUTCDay() + 6) % 7));

/** Adds each training day to the bar it falls in; days outside every bar are dropped. */
function fill(bars: Bar[], days: TrainingDay[], keyOf: (date: string) => string): Bar[] {
  const byKey = new Map(bars.map((b) => [b.key, b]));
  for (const day of days) {
    const bar = byKey.get(keyOf(day.date));
    if (bar) {
      bar.seconds += day.seconds;
      bar.sessions += day.sessions;
    }
  }
  return bars;
}

const empty = (key: string, label: string): Bar => ({ key, label, seconds: 0, sessions: 0 });

function buildBars(range: Range, today: string, days: TrainingDay[]): Bar[] {
  const now = toUTC(today);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  if (range === "Week") {
    const monday = mondayOf(now);
    const bars = WEEKDAYS.map((label, i) => empty(toDate(addDays(monday, i)), label));
    return fill(bars, days, (date) => date);
  }

  if (range === "Month") {
    // A week that spills over the month's edge counts this month's days only,
    // so the bars add up to the month. Each is labelled by its first day in it.
    const first = new Date(Date.UTC(year, month, 1));
    const last = new Date(Date.UTC(year, month + 1, 0));
    const bars: Bar[] = [];
    for (let d = first; d <= last; d = addDays(mondayOf(d), 7)) {
      bars.push(empty(toDate(mondayOf(d)), `${month + 1}/${d.getUTCDate()}`));
    }
    const prefix = today.slice(0, 7);
    return fill(bars, days.filter((d) => d.date.startsWith(prefix)), (date) => toDate(mondayOf(toUTC(date))));
  }

  if (range === "Year") {
    const bars = MONTHS.map((label, i) => empty(`${year}-${String(i + 1).padStart(2, "0")}`, label));
    return fill(bars, days, (date) => date.slice(0, 7));
  }

  // All: every month since the first workout, or every year once that is too many.
  const start = toUTC(days[0]?.date ?? today);
  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth();
  const monthCount = (year - startYear) * 12 + month - startMonth + 1;
  if (monthCount > MAX_MONTH_BARS) {
    const bars = Array.from({ length: year - startYear + 1 }, (_, i) =>
      empty(String(startYear + i), String(startYear + i)));
    return fill(bars, days, (date) => date.slice(0, 4));
  }
  const bars = Array.from({ length: monthCount }, (_, i) => {
    const d = new Date(Date.UTC(startYear, startMonth + i, 1));
    return empty(toDate(d).slice(0, 7), MONTHS[d.getUTCMonth()]);
  });
  return fill(bars, days, (date) => date.slice(0, 7));
}

/** The range in words, for the line under the chart. */
function rangeName(range: Range, today: string, days: TrainingDay[]): string {
  const now = toUTC(today);
  if (range === "Week") {
    const monday = mondayOf(now);
    const sunday = addDays(monday, 6);
    const short = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
    return `${short(monday)} – ${short(sunday)}`;
  }
  if (range === "Month") return `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  if (range === "Year") return String(now.getUTCFullYear());
  if (!days[0]) return "all time";
  const first = toUTC(days[0].date);
  return `since ${MONTHS[first.getUTCMonth()]} ${first.getUTCFullYear()}`;
}

/** 3900 → "1:05", for the small number over a bar. */
function barTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 3900 → "1h 5m". */
function fullTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

const plural = (n: number) => `${n} session${n === 1 ? "" : "s"}`;

/**
 * Training time as bars over this week, this month, this year or everything.
 * The server sends one row per training day; the tabs only choose how they are
 * grouped. The pick is remembered on this phone only.
 */
export function TimeChart({ today, days }: { today: string; days: TrainingDay[] }) {
  const [range, setRange] = useState<Range>("Week");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY) as Range | null;
      if (saved && RANGES.includes(saved)) setRange(saved);
    } catch { /* storage blocked — stay on Week */ }
  }, []);

  function pick(r: Range) {
    setRange(r);
    try { localStorage.setItem(STORE_KEY, r); } catch { /* ignore */ }
  }

  const bars = buildBars(range, today, days);
  const peak = Math.max(1, ...bars.map((b) => b.seconds));
  const seconds = bars.reduce((n, b) => n + b.seconds, 0);
  const sessions = bars.reduce((n, b) => n + b.sessions, 0);

  return (
    <Panel>
      <div className="grid grid-cols-4 gap-1">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => pick(r)}
            className={`display min-h-11 rounded-lg border text-sm font-semibold ${
              r === range
                ? "border-accent bg-accent text-black"
                : "border-line-2 bg-panel-2 text-ink-dim"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="mt-4 flex h-28 items-end gap-0.5 border-b border-line">
        {bars.map((b) => (
          <div
            key={b.key}
            className="flex min-w-0 flex-1 flex-col items-center justify-end"
            title={`${b.label}: ${fullTime(b.seconds)} · ${plural(b.sessions)}`}
          >
            {b.seconds > 0 && (
              <>
                <span className="display tnum mb-0.5 text-[10px] font-semibold text-ink-dim">
                  {barTime(b.seconds)}
                </span>
                <span
                  className="block w-full max-w-9 rounded-t bg-accent"
                  style={{ height: Math.max(3, (b.seconds / peak) * BAR_MAX) }}
                />
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5">
        {bars.map((b) => (
          <span key={b.key} className="min-w-0 flex-1 text-center text-[9px] text-ink-faint">
            {b.label}
          </span>
        ))}
      </div>

      <p className="tnum mt-3 text-[11px] text-ink-faint">
        {sessions === 0 ? (
          `Nothing logged · ${rangeName(range, today, days)}`
        ) : (
          <>
            <span className="text-ink">{fullTime(seconds)}</span> · {plural(sessions)} ·{" "}
            {rangeName(range, today, days)}
          </>
        )}
      </p>
    </Panel>
  );
}
