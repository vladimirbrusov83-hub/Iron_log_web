import Link from "next/link";
import {
  getBodyweight, getExerciseTotals, getHeadline, getMuscleTotals,
  getPersonalRecords, getSettings, getTrainingTime, getWeeklyMuscleTotals,
} from "@/lib/db";
import {
  BAND_COLOR, BandTag, Empty, Header, Page, Panel, SectionTitle, SetsBandBar, Stat,
} from "@/components/ui";
import { EFFECTIVE_REP_THRESHOLD, MAX_COUNTED_RIR } from "@/lib/effective-reps";
import {
  FREQUENCY_TARGET, HARD_SET_MAX_RIR, SESSION_ER_HIGH, SESSION_ER_LOW, WEEKLY_SETS_FLOOR,
  WEEKLY_SETS_HIGH, WEEKLY_SETS_LOW, weeklySetBand,
} from "@/lib/targets";
import { estimated1RM } from "@/lib/types";
import { BodyweightPanel } from "./bodyweight";
import { WeeklyChart } from "./weekly-chart";

export const dynamic = "force-dynamic";

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 365, label: "1 year" },
];

/** The training-time table shows every window at once, whatever tab is open. */
const TIME_WINDOWS: { days: number | null; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
  { days: null, label: "All time" },
];

export default async function StatsPage({
  searchParams,
}: { searchParams: Promise<{ days?: string }> }) {
  const { days: raw } = await searchParams;
  const days = WINDOWS.some((w) => String(w.days) === raw) ? Number(raw) : 7;
  const weeks = Math.max(1, days / 7);

  const [headline, weekly, muscles, exercises, records, bodyweight, settings, time] =
    await Promise.all([
      getHeadline(days),
      getWeeklyMuscleTotals(12),
      getMuscleTotals(days),
      getExerciseTotals(days),
      getPersonalRecords(),
      getBodyweight(),
      getSettings(),
      getTrainingTime(TIME_WINDOWS.map((w) => w.days)),
    ]);

  const unit = settings.weightUnit;
  const unrated = headline.workingSets - headline.ratedSets;

  return (
    <Page>
      <Header title="Stats" />

      <nav className="rise mb-4 grid grid-cols-3 gap-1 rounded-xl border border-line bg-panel p-1">
        {WINDOWS.map((w) => (
          <Link
            key={w.days}
            href={`/stats?days=${w.days}`}
            className={`display flex min-h-10 items-center justify-center rounded-lg text-base font-semibold ${
              w.days === days ? "bg-accent text-black" : "text-ink-dim"
            }`}
          >
            {w.label}
          </Link>
        ))}
      </nav>

      <section className="rise rise-1 mb-5 grid grid-cols-2 gap-2">
        <Stat
          label="Effective reps"
          value={headline.effectiveReps.toLocaleString("en-US")}
          hint={headline.workingSets === 0
            ? "nothing logged"
            : `${headline.ratedSets} of ${headline.workingSets} sets rated`}
          accent
          big
        />
        <div className="grid gap-2">
          <Stat label="Sessions" value={headline.sessions} />
          <Stat label="Working sets" value={headline.workingSets} />
        </div>
      </section>

      <section className="rise rise-2 mb-5">
        <SectionTitle>Days &amp; time trained</SectionTitle>
        <Panel>
          <table className="tnum w-full text-sm">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-ink-faint">
                <th className="pb-1.5 text-left font-normal"></th>
                <th className="pb-1.5 text-right font-normal">Days</th>
                <th className="pb-1.5 text-right font-normal">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {TIME_WINDOWS.map((w, i) => (
                <tr key={w.label}>
                  <td className="py-2 text-ink-dim">{w.label}</td>
                  <td className="display py-2 text-right text-lg font-semibold">
                    {time[i]?.daysTrained ?? 0}
                  </td>
                  <td className="display py-2 text-right text-lg font-semibold text-accent">
                    {fmtDuration(time[i]?.seconds ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </section>

      <section className="rise rise-2 mb-5">
        <SectionTitle>By muscle group · per week</SectionTitle>
        {muscles.length === 0 ? (
          <Empty>Nothing in this window.</Empty>
        ) : (
          <Panel>
            <ul className="divide-y divide-line/60">
              {muscles.map((m) => {
                const setsPerWeek = m.hardSets / weeks;
                const erPerSession = m.sessions > 0 ? m.effectiveReps / m.sessions : 0;
                const freq = m.sessions / weeks;
                const band = weeklySetBand(Math.round(setsPerWeek));
                return (
                  <li key={m.muscleGroup} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="display text-lg font-semibold">{m.muscleGroup}</span>
                      <BandTag band={band} />
                    </div>
                    <div className="mt-1.5">
                      <SetsBandBar sets={setsPerWeek} band={band} />
                    </div>
                    <div className="tnum mt-2 grid grid-cols-4 gap-1 text-center">
                      <Cell label="hard sets/wk" value={fmt(setsPerWeek)} tone={BAND_COLOR[band]} />
                      <Cell label="eff reps/wk" value={fmt(m.effectiveReps / weeks)} tone="text-accent" />
                      <Cell
                        label="eff/session"
                        value={fmt(erPerSession)}
                        tone={erPerSession >= SESSION_ER_LOW && erPerSession <= SESSION_ER_HIGH
                          ? "text-good" : "text-ink"}
                      />
                      <Cell
                        label="sessions/wk"
                        value={fmt(freq)}
                        tone={freq >= FREQUENCY_TARGET ? "text-good" : "text-ink"}
                      />
                    </div>
                    {m.ratedSets < m.workingSets && (
                      <p className="mt-1.5 text-[11px] text-ink-faint">
                        {m.workingSets - m.ratedSets} of {m.workingSets} working sets had no RIR
                        and are not counted as hard.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </section>

      {/* Said once, here, rather than repeated under every number above. */}
      <Panel className="rise rise-3 mb-5">
        <h2 className="eyebrow">How this is counted</h2>
        <dl className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink-dim">
          <div>
            <dt className="inline text-ink">Effective reps. </dt>
            <dd className="inline">
              A set scores {EFFECTIVE_REP_THRESHOLD} − RIR, capped at the reps done. To failure
              scores {EFFECTIVE_REP_THRESHOLD}; at 2 RIR, 3. Above {MAX_COUNTED_RIR} RIR a set
              does not count at all — not scored, not a working set, no volume.
              {unrated > 0 && (
                <> <span className="text-ink">{unrated} set{unrated === 1 ? "" : "s"} in this window
                had no RIR</span> and count as zero, so the totals are a floor.</>
              )}
            </dd>
          </div>
          <div>
            <dt className="inline text-ink">Hard set. </dt>
            <dd className="inline">
              A working set finished within {HARD_SET_MAX_RIR} reps of failure. Floor{" "}
              {WEEKLY_SETS_FLOOR} a week per muscle; productive range {WEEKLY_SETS_LOW}–{WEEKLY_SETS_HIGH}.
            </dd>
          </div>
          <div>
            <dt className="inline text-ink">Per session. </dt>
            <dd className="inline">
              {SESSION_ER_LOW}–{SESSION_ER_HIGH} effective reps per muscle, trained{" "}
              {FREQUENCY_TARGET}× a week. From <em>Hypertrophy Training — Principles That Work</em>.
            </dd>
          </div>
        </dl>
      </Panel>

      <section className="rise rise-4 mb-5">
        <SectionTitle>Effective reps by week</SectionTitle>
        <WeeklyChart weeks={weekly.weeks} rows={weekly.rows} />
      </section>

      <section className="mb-5">
        <SectionTitle>By exercise</SectionTitle>
        {exercises.length === 0 ? (
          <Empty>Nothing in this window.</Empty>
        ) : (
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr>
                  <th className="eyebrow pb-2 font-semibold">Lift</th>
                  <th className="eyebrow pb-2 text-right font-semibold">Eff</th>
                  <th className="eyebrow pb-2 text-right font-semibold">Sets</th>
                  <th className="eyebrow pb-2 text-right font-semibold">Best e1RM</th>
                </tr>
              </thead>
              <tbody className="tnum divide-y divide-line/60">
                {exercises.map((e) => (
                  <tr key={e.name}>
                    <td className="py-2 pr-2">{e.name}</td>
                    <td className="display py-2 text-right text-base font-semibold text-accent">
                      {e.effectiveReps}
                    </td>
                    <td className="py-2 text-right text-ink-dim">
                      {e.workingSets}{e.ratedSets < e.workingSets && "*"}
                    </td>
                    <td className="py-2 text-right text-ink-dim">
                      {e.best1RM ? `${Math.round(e.best1RM)} ${unit}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {exercises.some((e) => e.ratedSets < e.workingSets) && (
              <p className="mt-2 text-[11px] text-ink-faint">* some sets had no RIR</p>
            )}
          </Panel>
        )}
      </section>

      <section className="mb-5">
        <SectionTitle>Personal records</SectionTitle>
        {records.length === 0 ? (
          <Empty>Records appear when you finish a session that beats one.</Empty>
        ) : (
          <Panel>
            <ul className="tnum divide-y divide-line/60 text-sm">
              {records.map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="truncate">{r.exerciseName}</span>
                  <span className="shrink-0 text-ink-dim">
                    <span className="text-ink">{r.weight} {unit} × {r.reps}</span>
                    <span className="text-ink-faint"> · {Math.round(estimated1RM(r.weight, r.reps))} e1RM</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>

      <BodyweightPanel entries={bodyweight} unit={unit} />
    </Page>
  );
}

/** 7260 → "2h 1m", 900 → "15m". */
function fmtDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Cell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg bg-panel-2 px-1 py-1.5">
      <div className={`display text-lg font-semibold ${tone}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-ink-faint">{label}</div>
    </div>
  );
}
