import Link from "next/link";
import { startWorkout } from "./actions";
import {
  getActiveSession, getFinishedSessions, getHeadline, getPrograms, getSettings,
} from "@/lib/db";
import { Button, ButtonLink, Empty, Header, Page, Panel, Stat } from "@/components/ui";
import { totalEffectiveReps } from "@/lib/effective-reps";
import { formatDuration, sessionVolume } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [active, programs, recent, week, settings] = await Promise.all([
    getActiveSession(),
    getPrograms(),
    getFinishedSessions(3),
    getHeadline(7),
    getSettings(),
  ]);

  const pinned = programs.find((p) => p.isPinned) ?? programs[0] ?? null;
  const unit = settings.weightUnit;

  return (
    <Page>
      <Header
        title="IronLog"
        subtitle={new Date().toLocaleDateString(undefined, {
          weekday: "long", month: "long", day: "numeric",
        })}
      />

      {active && (
        <Panel className="mb-4 border-accent-dim bg-accent/10">
          <p className="text-xs uppercase tracking-wide text-accent">Workout in progress</p>
          <h2 className="mt-0.5 text-lg font-medium">{active.dayName}</h2>
          <p className="tnum mt-0.5 text-sm text-ink-dim">
            {totalEffectiveReps(active.exercises.flatMap((e) => e.sets))} effective reps so far
          </p>
          <ButtonLink href={`/log/${active.id}`} variant="primary" className="mt-3 w-full">
            Continue
          </ButtonLink>
        </Panel>
      )}

      <section className="mb-5 grid grid-cols-2 gap-2">
        <Stat
          label="Eff reps · 7d"
          value={week.effectiveReps.toLocaleString()}
          hint={week.workingSets === 0
            ? "no sets yet"
            : `${week.ratedSets}/${week.workingSets} sets rated`}
          accent
        />
        <Stat
          label="Volume · 7d"
          value={`${Math.round(week.volume).toLocaleString()}`}
          hint={`${unit} · ${week.sessions} session${week.sessions === 1 ? "" : "s"}`}
        />
      </section>

      {!active && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-medium text-ink-dim">Start a workout</h2>
          {pinned ? (
            <Panel>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="truncate font-medium">{pinned.name}</h3>
                <Link href="/programs" className="shrink-0 text-xs text-accent">Change</Link>
              </div>
              <ul className="mt-3 space-y-2">
                {pinned.days.map((day) => (
                  <li key={day.id}>
                    <form action={startWorkout.bind(null, day.id)}>
                      <button
                        className="flex min-h-12 w-full items-center justify-between rounded-lg
                                   border border-line bg-panel-2 px-3 text-left"
                      >
                        <span className="truncate">{day.name}</span>
                        <span className="ml-2 shrink-0 text-[11px] text-ink-faint">
                          {day.exercises.length} lifts
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={startWorkout.bind(null, null)} className="mt-3">
                <Button type="submit" className="w-full">Freestyle — no program</Button>
              </form>
            </Panel>
          ) : (
            <Panel>
              <p className="text-sm text-ink-dim">
                No programs yet. Start freestyle and add lifts as you go, or build a program first.
              </p>
              <div className="mt-3 flex gap-2">
                <form action={startWorkout.bind(null, null)} className="flex-1">
                  <Button type="submit" variant="primary" className="w-full">Freestyle</Button>
                </form>
                <ButtonLink href="/programs" className="flex-1">Programs</ButtonLink>
              </div>
            </Panel>
          )}
        </section>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-ink-dim">Recent</h2>
          <Link href="/history" className="text-xs text-accent">All history</Link>
        </div>
        {recent.length === 0 ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/history/${s.id}`}
                  className="block rounded-xl border border-line bg-panel px-4 py-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{s.dayName}</span>
                    <span className="tnum shrink-0 text-xs text-ink-faint">
                      {new Date(s.startedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="tnum mt-0.5 text-xs text-ink-faint">
                    {totalEffectiveReps(s.exercises.flatMap((e) => e.sets))} eff reps ·{" "}
                    {Math.round(sessionVolume(s)).toLocaleString()} {unit} ·{" "}
                    {formatDuration(s.durationSeconds)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
