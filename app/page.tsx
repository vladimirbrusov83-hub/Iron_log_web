import Link from "next/link";
import { startWorkout } from "./actions";
import {
  getActiveSession, getFinishedSessions, getHeadline, getMuscleTotals, getPrograms, getSettings,
} from "@/lib/db";
import {
  BAND_COLOR, Button, ButtonLink, Empty, Header, Page, Panel, SectionTitle, SetsBandBar, Stat,
} from "@/components/ui";
import { effectiveRepsCoverage, totalEffectiveReps } from "@/lib/effective-reps";
import { WEEKLY_SETS_HIGH, WEEKLY_SETS_LOW, weeklySetBand } from "@/lib/targets";
import { formatDuration, sessionVolume } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [active, programs, recent, week, muscles, settings] = await Promise.all([
    getActiveSession(),
    getPrograms(),
    getFinishedSessions(3),
    getHeadline(7),
    getMuscleTotals(7),
    getSettings(),
  ]);

  const pinned = programs.find((p) => p.isPinned) ?? programs[0] ?? null;
  const unit = settings.weightUnit;
  const today = new Date();

  return (
    <Page>
      <Header
        eyebrow={today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        title="IronLog"
      />

      {active && (
        <ActiveCard
          id={active.id}
          name={active.dayName}
          program={active.programName}
          effectiveReps={totalEffectiveReps(active.exercises.flatMap((e) => e.sets))}
          coverage={effectiveRepsCoverage(active.exercises.flatMap((e) => e.sets))}
        />
      )}

      <section className="rise rise-1 mb-5 grid grid-cols-2 gap-2">
        <Stat
          label="Effective reps · 7d"
          value={week.effectiveReps.toLocaleString()}
          hint={week.workingSets === 0
            ? "no sets yet"
            : `${week.ratedSets} of ${week.workingSets} sets rated`}
          accent
          big
        />
        <div className="grid gap-2">
          <Stat label="Sessions · 7d" value={week.sessions} />
          <Stat
            label="Volume · 7d"
            value={Math.round(week.volume).toLocaleString()}
            hint={unit}
          />
        </div>
      </section>

      <section className="rise rise-2 mb-5">
        <SectionTitle action={<Link href="/stats" className="text-xs text-accent">Details</Link>}>
          Hard sets per muscle · last 7 days
        </SectionTitle>
        {muscles.length === 0 ? (
          <Empty>Finish a workout and each muscle you trained shows up here.</Empty>
        ) : (
          <Panel>
            <ul className="space-y-3">
              {muscles.map((m) => {
                const band = weeklySetBand(m.hardSets);
                return (
                  <li key={m.muscleGroup}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{m.muscleGroup}</span>
                      <span className="tnum text-xs">
                        <span className={`display text-base font-semibold ${BAND_COLOR[band]}`}>
                          {m.hardSets}
                        </span>
                        <span className="text-ink-faint"> hard sets · </span>
                        <span className="text-accent">{m.effectiveReps}</span>
                        <span className="text-ink-faint"> eff reps</span>
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <SetsBandBar sets={m.hardSets} band={band} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] leading-snug text-ink-faint">
              Green band is the productive range, {WEEKLY_SETS_LOW}–{WEEKLY_SETS_HIGH} hard sets a
              week. The tick is the floor. A hard set finished within 3 reps of failure.
            </p>
          </Panel>
        )}
      </section>

      {!active && (
        <section className="rise rise-3 mb-5">
          <SectionTitle>Start a workout</SectionTitle>
          {pinned ? (
            <Panel>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="display truncate text-xl font-semibold">{pinned.name}</h3>
                <Link href="/programs" className="shrink-0 text-xs text-accent">Change</Link>
              </div>
              <ul className="mt-3 space-y-2">
                {pinned.days.map((day, i) => (
                  <li key={day.id}>
                    <form action={startWorkout.bind(null, day.id)}>
                      <button
                        className="group flex min-h-13 w-full items-center gap-3 rounded-xl
                                   border border-line-2 bg-panel-2 px-3 text-left
                                   transition-colors hover:border-accent/60 active:bg-panel-3"
                      >
                        <span className="display tnum w-6 text-lg font-semibold text-ink-faint">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{day.name}</span>
                          <span className="block truncate text-[11px] text-ink-faint">
                            {day.exercises.map((e) => e.name).join(" · ")}
                          </span>
                        </span>
                        <span className="text-ink-faint transition-colors group-hover:text-accent">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                               strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={startWorkout.bind(null, null)} className="mt-3">
                <Button type="submit" variant="ghost" className="w-full">
                  Freestyle — no program
                </Button>
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

      <section className="rise rise-4">
        <SectionTitle action={<Link href="/history" className="text-xs text-accent">All history</Link>}>
          Recent
        </SectionTitle>
        {recent.length === 0 ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/history/${s.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3
                             transition-colors hover:border-line-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.dayName}</div>
                    <p className="tnum mt-0.5 text-xs text-ink-faint">
                      {new Date(s.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      {" · "}{Math.round(sessionVolume(s)).toLocaleString()} {unit}
                      {" · "}{formatDuration(s.durationSeconds)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="display tnum text-2xl font-semibold text-accent">
                      {totalEffectiveReps(s.exercises.flatMap((e) => e.sets))}
                    </div>
                    <div className="eyebrow" style={{ fontSize: 9 }}>eff reps</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

function ActiveCard({
  id, name, program, effectiveReps, coverage,
}: {
  id: string; name: string; program: string; effectiveReps: number;
  coverage: { scored: number; working: number };
}) {
  return (
    <section
      className="rise mb-4 overflow-hidden rounded-2xl border border-accent/40 p-4"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,106,31,0.22), rgba(255,106,31,0.06) 60%, transparent)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5 text-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            In progress{program ? ` · ${program}` : ""}
          </p>
          <h2 className="display mt-1 truncate text-3xl font-semibold">{name}</h2>
        </div>
        <div className="shrink-0 text-right">
          <div className="display tnum text-4xl font-semibold text-accent">{effectiveReps}</div>
          <div className="eyebrow" style={{ fontSize: 9 }}>
            eff reps · {coverage.scored}/{coverage.working} rated
          </div>
        </div>
      </div>
      <ButtonLink href={`/log/${id}`} variant="primary" className="mt-4 w-full">
        Continue workout
      </ButtonLink>
    </section>
  );
}
