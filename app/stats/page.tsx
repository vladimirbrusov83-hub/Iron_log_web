import Link from "next/link";
import {
  getBodyweight, getExerciseTotals, getHeadline, getMuscleTotals,
  getPersonalRecords, getSettings, getWeeklyTotals,
} from "@/lib/db";
import { Bar, Empty, Header, Page, Panel, Stat } from "@/components/ui";
import { EFFECTIVE_REP_THRESHOLD } from "@/lib/effective-reps";
import { estimated1RM } from "@/lib/types";
import { BodyweightPanel } from "./bodyweight";

export const dynamic = "force-dynamic";

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 365, label: "1 year" },
];

export default async function StatsPage({
  searchParams,
}: { searchParams: Promise<{ days?: string }> }) {
  const { days: raw } = await searchParams;
  const days = WINDOWS.some((w) => String(w.days) === raw) ? Number(raw) : 30;

  const [headline, weekly, muscles, exercises, records, bodyweight, settings] =
    await Promise.all([
      getHeadline(days),
      getWeeklyTotals(12),
      getMuscleTotals(days),
      getExerciseTotals(days),
      getPersonalRecords(),
      getBodyweight(),
      getSettings(),
    ]);

  const unit = settings.weightUnit;
  const unrated = headline.workingSets - headline.ratedSets;
  const peakWeekly = Math.max(1, ...weekly.map((w) => w.effectiveReps));
  const peakMuscle = Math.max(1, ...muscles.map((m) => m.effectiveReps));

  return (
    <Page>
      <Header title="Stats" />

      <nav className="mb-4 flex gap-1.5">
        {WINDOWS.map((w) => (
          <Link
            key={w.days}
            href={`/stats?days=${w.days}`}
            className={`min-h-10 flex-1 rounded-lg border px-2 text-center text-sm leading-10 ${
              w.days === days
                ? "border-accent text-accent"
                : "border-line bg-panel text-ink-dim"
            }`}
          >
            {w.label}
          </Link>
        ))}
      </nav>

      <section className="mb-5 grid grid-cols-2 gap-2">
        <Stat
          label="Effective reps"
          value={headline.effectiveReps.toLocaleString()}
          hint={headline.workingSets === 0
            ? "nothing logged"
            : `${headline.ratedSets}/${headline.workingSets} sets rated`}
          accent
        />
        <Stat
          label="Volume"
          value={Math.round(headline.volume).toLocaleString()}
          hint={unit}
        />
        <Stat label="Sessions" value={headline.sessions} />
        <Stat label="Working sets" value={headline.workingSets} />
      </section>

      {/* Said once, here, rather than repeated under every number below. */}
      <Panel className="mb-5">
        <h2 className="text-sm font-medium">How effective reps are counted</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          Only the last {EFFECTIVE_REP_THRESHOLD} reps before failure are counted as
          stimulating, so a set scores{" "}
          <span className="text-ink">{EFFECTIVE_REP_THRESHOLD} − RIR</span>, capped at
          the reps you actually did. A set to failure scores {EFFECTIVE_REP_THRESHOLD}; at
          2 RIR it scores 3; at {EFFECTIVE_REP_THRESHOLD}+ RIR it scores nothing.
          Warmups score nothing.
          {unrated > 0 && (
            <>
              {" "}
              <span className="text-ink">
                {unrated} set{unrated === 1 ? "" : "s"} in this window had no RIR
              </span>{" "}
              and count as zero here — the totals below are a floor, not a measurement.
            </>
          )}
        </p>
      </Panel>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-medium text-ink-dim">Effective reps by week</h2>
        {weekly.length === 0 ? (
          <Empty>No finished sessions yet.</Empty>
        ) : (
          <Panel>
            <ul className="space-y-2">
              {weekly.map((w) => (
                <li key={w.weekStart}>
                  <div className="tnum flex items-baseline justify-between text-xs">
                    <span className="text-ink-dim">
                      {new Date(`${w.weekStart}T00:00:00`).toLocaleDateString(undefined, {
                        month: "short", day: "numeric",
                      })}
                    </span>
                    <span>
                      <span className="text-accent">{w.effectiveReps}</span>
                      <span className="text-ink-faint">
                        {" "}· {w.workingSets} sets · {Math.round(w.volume).toLocaleString()} {unit}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1">
                    <Bar fraction={w.effectiveReps / peakWeekly} accent />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-medium text-ink-dim">By muscle group</h2>
        {muscles.length === 0 ? (
          <Empty>Nothing in this window.</Empty>
        ) : (
          <Panel>
            <ul className="space-y-2.5">
              {muscles.map((m) => (
                <li key={m.muscleGroup}>
                  <div className="tnum flex items-baseline justify-between text-xs">
                    <span>{m.muscleGroup}</span>
                    <span>
                      <span className="text-accent">{m.effectiveReps}</span>
                      <span className="text-ink-faint"> · {m.workingSets} sets</span>
                      {m.ratedSets < m.workingSets && (
                        <span className="text-ink-faint">
                          {" "}({m.workingSets - m.ratedSets} unrated)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1">
                    <Bar fraction={m.effectiveReps / peakMuscle} accent />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-medium text-ink-dim">By exercise</h2>
        {exercises.length === 0 ? (
          <Empty>Nothing in this window.</Empty>
        ) : (
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="pb-2 font-normal">Lift</th>
                  <th className="pb-2 text-right font-normal">Eff</th>
                  <th className="pb-2 text-right font-normal">Sets</th>
                  <th className="pb-2 text-right font-normal">Best e1RM</th>
                </tr>
              </thead>
              <tbody className="tnum divide-y divide-line/60">
                {exercises.map((e) => (
                  <tr key={e.name}>
                    <td className="py-1.5 pr-2">{e.name}</td>
                    <td className="py-1.5 text-right text-accent">{e.effectiveReps}</td>
                    <td className="py-1.5 text-right text-ink-faint">
                      {e.workingSets}
                      {e.ratedSets < e.workingSets && (
                        <span className="text-ink-faint">*</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-ink-dim">
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
        <h2 className="mb-2 text-sm font-medium text-ink-dim">Personal records</h2>
        {records.length === 0 ? (
          <Empty>Records appear when you finish a session that beats one.</Empty>
        ) : (
          <Panel>
            <ul className="tnum space-y-1.5 text-sm">
              {records.map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-2">
                  <span className="truncate">{r.exerciseName}</span>
                  <span className="shrink-0 text-ink-dim">
                    {r.weight} {unit} × {r.reps}
                    <span className="text-ink-faint">
                      {" "}· {Math.round(estimated1RM(r.weight, r.reps))} e1RM
                    </span>
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
