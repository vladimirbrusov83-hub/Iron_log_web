import Link from "next/link";
import { notFound } from "next/navigation";
import { removeSession } from "@/app/actions";
import { getSession, getSettings } from "@/lib/db";
import { Button, Header, Page, Panel, Stat } from "@/components/ui";
import {
  effectiveReps, effectiveRepsCoverage, totalEffectiveReps,
} from "@/lib/effective-reps";
import { formatDuration, sessionVolume } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, settings] = await Promise.all([getSession(id), getSettings()]);
  if (!session) notFound();

  const sets = session.exercises.flatMap((e) => e.sets);
  const coverage = effectiveRepsCoverage(sets);
  const unit = settings.weightUnit;

  return (
    <Page>
      <Link href="/history" className="text-sm text-accent">‹ History</Link>
      <Header
        title={session.dayName}
        subtitle={new Date(session.startedAt).toLocaleString(undefined, {
          weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit",
        })}
      />

      <section className="mb-5 grid grid-cols-2 gap-2">
        <Stat
          label="Effective reps"
          value={totalEffectiveReps(sets)}
          hint={`${coverage.scored}/${coverage.working} sets rated`}
          accent
        />
        <Stat
          label="Volume"
          value={Math.round(sessionVolume(session)).toLocaleString()}
          hint={`${unit} · ${formatDuration(session.durationSeconds)}`}
        />
      </section>

      <div className="space-y-3">
        {session.exercises.map((log) => (
          <Panel key={log.id}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate font-medium">{log.name}</h2>
                <p className="text-[11px] text-ink-faint">{log.muscleGroup}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="tnum font-semibold text-accent">{totalEffectiveReps(log.sets)}</div>
                <div className="text-[10px] uppercase tracking-wide text-ink-faint">eff reps</div>
              </div>
            </div>

            <ul className="mt-2 divide-y divide-line/60">
              {log.sets.map((s) => {
                const score = effectiveReps(s);
                return (
                  <li key={s.id} className="tnum flex items-center gap-3 py-1.5 text-sm">
                    <span className="w-5 text-ink-faint">{s.isWarmup ? "W" : s.setNumber}</span>
                    <span className="flex-1">
                      {s.weight} {unit} × {s.reps}
                      {s.rir !== null && (
                        <span className="text-ink-faint"> @{s.rir} RIR</span>
                      )}
                    </span>
                    <span className={score ? "text-accent" : "text-ink-faint"}>
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
          <h2 className="text-[11px] uppercase tracking-wide text-ink-faint">Session notes</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">{session.notes}</p>
        </Panel>
      )}

      <form action={removeSession.bind(null, session.id)} className="mt-5">
        <Button variant="danger" className="w-full">Delete this session</Button>
      </form>
    </Page>
  );
}
