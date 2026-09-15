import { notFound } from "next/navigation";
import { removeSession } from "@/app/actions";
import { getSession, getSettings } from "@/lib/db";
import { BAND_COLOR, Button, Header, Page, Panel, SectionTitle, Stat } from "@/components/ui";
import {
  effectiveReps, effectiveRepsByMuscle, effectiveRepsCoverage, totalEffectiveReps,
} from "@/lib/effective-reps";
import { SESSION_ER_HIGH, SESSION_ER_LOW, sessionErBand } from "@/lib/targets";
import { formatDuration, sessionVolume } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, settings] = await Promise.all([getSession(id), getSettings()]);
  if (!session) notFound();

  const sets = session.exercises.flatMap((e) => e.sets);
  const coverage = effectiveRepsCoverage(sets);
  const byMuscle = effectiveRepsByMuscle(session.exercises);
  const peak = Math.max(1, ...byMuscle.map((m) => m.effectiveReps));
  const unit = settings.weightUnit;

  return (
    <Page>
      <Header
        back={{ href: "/history", label: "History" }}
        eyebrow={session.programName || "Freestyle"}
        title={session.dayName}
        subtitle={new Date(session.startedAt).toLocaleString(undefined, {
          weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        })}
      />

      <section className="rise rise-1 mb-5 grid grid-cols-2 gap-2">
        <Stat
          label="Effective reps"
          value={totalEffectiveReps(sets)}
          hint={`${coverage.scored} of ${coverage.working} sets rated`}
          accent
          big
        />
        <div className="grid gap-2">
          <Stat label="Volume" value={Math.round(sessionVolume(session)).toLocaleString()} hint={unit} />
          <Stat label="Duration" value={formatDuration(session.durationSeconds)} />
        </div>
      </section>

      {byMuscle.length > 0 && (
        <section className="rise rise-2 mb-5">
          <SectionTitle>Effective reps by muscle</SectionTitle>
          <Panel>
            <ul className="space-y-2.5">
              {byMuscle.map((m) => {
                const band = sessionErBand(m.effectiveReps);
                return (
                  <li key={m.muscleGroup}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{m.muscleGroup}</span>
                      <span className="tnum text-xs text-ink-faint">
                        <span className={`display text-base font-semibold ${BAND_COLOR[band]}`}>
                          {m.effectiveReps}
                        </span>
                        {" · "}{m.workingSets} sets
                        {m.scoredSets < m.workingSets && ` (${m.workingSets - m.scoredSets} unrated)`}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-panel-3">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(m.effectiveReps / peak) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-ink-faint">
              Reference: {SESSION_ER_LOW}–{SESSION_ER_HIGH} effective reps per muscle per session.
            </p>
          </Panel>
        </section>
      )}

      <div className="rise rise-3 space-y-3">
        {session.exercises.map((log, i) => (
          <Panel key={log.id}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="display tnum text-sm font-semibold text-ink-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h2 className="display truncate text-xl font-semibold">{log.name}</h2>
                  <p className="text-[11px] text-ink-faint">{log.muscleGroup}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="display tnum text-2xl font-semibold text-accent">
                  {totalEffectiveReps(log.sets)}
                </div>
                <div className="eyebrow" style={{ fontSize: 9 }}>eff reps</div>
              </div>
            </div>

            <ul className="mt-2 divide-y divide-line/60">
              {log.sets.map((s) => {
                const score = effectiveReps(s);
                return (
                  <li key={s.id} className="tnum flex items-center gap-3 py-1.5 text-sm">
                    <span className="display w-5 font-semibold text-ink-faint">
                      {s.isWarmup ? "W" : s.setNumber}
                    </span>
                    <span className="flex-1">
                      <span className="font-medium">{s.weight}</span>
                      <span className="text-ink-faint"> {unit} × </span>
                      <span className="font-medium">{s.reps}</span>
                      {s.rir !== null && (
                        <span className="text-ink-faint"> @ {s.rir === 5 ? "5+" : s.rir} RIR</span>
                      )}
                    </span>
                    <span className={`display text-base font-semibold ${score ? "text-accent" : "text-ink-faint"}`}>
                      {score === null ? "–" : score}
                    </span>
                  </li>
                );
              })}
            </ul>

            {log.notes && <p className="mt-2 text-xs text-ink-dim">{log.notes}</p>}
          </Panel>
        ))}
      </div>

      {session.notes && (
        <Panel className="mt-3">
          <h2 className="eyebrow">Session notes</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">{session.notes}</p>
        </Panel>
      )}

      <form action={removeSession.bind(null, session.id)} className="mt-6">
        <Button variant="danger" className="w-full">Delete this session</Button>
      </form>
    </Page>
  );
}
