import Link from "next/link";
import { Suspense } from "react";
import {
  getActiveSession, getFinishedSessions, getHeadline, getMuscleTotals,
  getProgramsByRecentUse, getSettings,
} from "@/lib/db";
import {
  BAND_COLOR, ButtonLink, Header, Page, Panel, SetsBandBar,
} from "@/components/ui";
import { ProgramCarousel } from "@/components/program-carousel";
import { CachedHome, RememberHome, TilesSkeleton } from "@/components/cached-home";
import { effectiveRepsCoverage, totalEffectiveReps } from "@/lib/effective-reps";
import { WEEKLY_SETS_HIGH, WEEKLY_SETS_LOW, weeklySetBand } from "@/lib/targets";
import { formatDuration, sessionVolume } from "@/lib/types";

export const dynamic = "force-dynamic";

/* The page itself touches no database, so its HTML goes out at once — before a
   cold Neon has answered. Everything that needs data is `HomeLive`, streamed in
   behind a Suspense boundary. Until it lands, `CachedHome` paints the program
   card from the copy the last visit left in localStorage; the moment the live
   block arrives, a sibling CSS rule hides the copy (see `[data-home-live]` in
   globals.css). The copy is programs only — never logged sets. */
export default function HomePage() {
  const today = new Date();
  return (
    <Page>
      <Header
        eyebrow={today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        title="IronLog"
      />
      <div>
        <Suspense fallback={<TilesSkeleton />}>
          <HomeLive />
        </Suspense>
        <CachedHome />
      </div>
    </Page>
  );
}

async function HomeLive() {
  const [active, programs, recent, week, muscles, settings] = await Promise.all([
    getActiveSession(),
    getProgramsByRecentUse(),
    getFinishedSessions(3),
    getHeadline(7),
    getMuscleTotals(7),
    getSettings(),
  ]);

  // Ordered most-recently-trained first, so the card opens on the one being run.
  const hasProgram = programs.length > 0;
  const unit = settings.weightUnit;

  return (
    <div data-home-live>
      <RememberHome programs={programs} active={!!active} />

      {active && (
        <ActiveCard
          id={active.id}
          name={active.dayName}
          program={active.programName}
          effectiveReps={totalEffectiveReps(active.exercises.flatMap((e) => e.sets))}
          coverage={effectiveRepsCoverage(active.exercises.flatMap((e) => e.sets))}
        />
      )}

      {/* Three numbers on one line. The week's detail lives in the drawer below
          and on Stats; this is only the glance. */}
      <section className="rise rise-1 mb-4 grid grid-cols-3 gap-2">
        <Tile label={`Eff reps · 7d`} value={week.effectiveReps.toLocaleString("en-US")} accent />
        <Tile label="Sessions" value={String(week.sessions)} />
        <Tile label={`Volume · ${unit}`} value={Math.round(week.volume).toLocaleString("en-US")} />
      </section>

      {/* ------------------------------------------------ the point of the page */}
      {!active && (
        <section className="mb-4">
          {hasProgram ? (
            <ProgramCarousel programs={programs} />
          ) : (
            <Panel>
              <p className="eyebrow text-accent">Start a workout</p>
              <p className="mt-2 text-sm text-ink-dim">
                No programs yet. Start freestyle and add lifts as you go, or build a program first.
              </p>
              <div className="mt-3 flex gap-2">
                <ButtonLink href="/start" variant="primary" className="flex-1">Start</ButtonLink>
                <ButtonLink href="/programs" className="flex-1">Programs</ButtonLink>
              </div>
            </Panel>
          )}
        </section>
      )}

      {/* Folded away by default. The headline it needs to carry — which muscles
          got worked and how hard — is on the summary row, so opening it is for
          the bars, not for the news. Native <details>, so it costs no JS. */}
      <details className="rise rise-3 group mb-4 overflow-hidden rounded-2xl border border-line bg-panel">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Hard sets per muscle · 7d</p>
            <p className="tnum mt-0.5 truncate text-sm">
              {muscles.length === 0 ? (
                <span className="text-ink-faint">Nothing logged this week</span>
              ) : (
                muscles.map((m, i) => (
                  <span key={m.muscleGroup}>
                    {i > 0 && <span className="text-ink-faint"> · </span>}
                    <span className="text-ink-dim">{m.muscleGroup} </span>
                    <span className={`font-semibold ${BAND_COLOR[weeklySetBand(m.hardSets)]}`}>
                      {m.hardSets}
                    </span>
                  </span>
                ))
              )}
            </p>
          </div>
          <svg
            className="shrink-0 text-ink-faint transition-transform group-open:rotate-180"
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M5 9l7 7 7-7" />
          </svg>
        </summary>

        <div className="border-t border-line px-4 py-3">
          {muscles.length === 0 ? (
            <p className="text-sm text-ink-faint">
              Finish a workout and each muscle you trained shows up here.
            </p>
          ) : (
            <>
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
              <Link href="/stats" className="mt-2 inline-block text-xs text-accent">
                Full breakdown on Stats →
              </Link>
            </>
          )}
        </div>
      </details>

      <details className="rise rise-4 group mb-4 overflow-hidden rounded-2xl border border-line bg-panel">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Recent workouts</p>
            <p className="tnum mt-0.5 truncate text-sm">
              {recent.length === 0 ? (
                <span className="text-ink-faint">Nothing logged yet</span>
              ) : (
                <>
                  <span className="text-ink-dim">Last: {recent[0].dayName} · </span>
                  <span className="text-ink-faint">
                    {new Date(recent[0].startedAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                    })}
                  </span>
                  <span className="text-accent">
                    {" "}{totalEffectiveReps(recent[0].exercises.flatMap((e) => e.sets))} eff reps
                  </span>
                </>
              )}
            </p>
          </div>
          <svg
            className="shrink-0 text-ink-faint transition-transform group-open:rotate-180"
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M5 9l7 7 7-7" />
          </svg>
        </summary>

        <div className="border-t border-line px-4 py-3">
          {recent.length === 0 ? (
            <p className="text-sm text-ink-faint">Finished workouts show up here.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {recent.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/history/${s.id}`}
                      className="flex items-center gap-3 rounded-xl border border-line-2 bg-panel-2
                                 px-3 py-2.5 transition-colors hover:border-ink-faint"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{s.dayName}</div>
                        <p className="tnum mt-0.5 text-xs text-ink-faint">
                          {new Date(s.startedAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric",
                          })}
                          {" · "}{Math.round(sessionVolume(s)).toLocaleString("en-US")} {unit}
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
              <Link href="/history" className="mt-3 inline-block text-xs text-accent">
                All history →
              </Link>
            </>
          )}
        </div>
      </details>
    </div>
  );
}

/** A compact headline number. Smaller than `Stat` because three sit on one row. */
function Tile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-2.5 py-2.5">
      <div className="eyebrow truncate" style={{ fontSize: 9 }}>{label}</div>
      <div className={`display tnum mt-0.5 truncate text-2xl font-semibold ${accent ? "text-accent" : ""}`}>
        {value}
      </div>
    </div>
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
