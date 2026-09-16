import Link from "next/link";
import { redirect } from "next/navigation";
import { startWorkout } from "@/app/actions";
import { getActiveSession, getLastDayUse, getProgramsByRecentUse } from "@/lib/db";
import { Button, Empty, Header, Page, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * The week: every workout in the chosen program, in full, with the last time
 * each was trained. Reached from Start on the home screen when the day has not
 * been decided yet — picking one straight off the home card skips this.
 */
export default async function StartPage({
  searchParams,
}: { searchParams: Promise<{ program?: string }> }) {
  const [{ program: wanted }, active, programs] = await Promise.all([
    searchParams,
    getActiveSession(),
    getProgramsByRecentUse(),
  ]);

  // Starting a second workout is not a thing; send them to the one that is open.
  if (active) redirect(`/log/${active.id}`);

  const program = programs.find((p) => p.id === wanted) ?? programs[0] ?? null;
  const lastUse = await getLastDayUse(program?.id ?? null);

  return (
    <Page>
      <Header
        back={{ href: "/", label: "Today" }}
        eyebrow={program ? program.name : "No program"}
        title="This week"
        subtitle={program
          ? `${program.days.length} workout${program.days.length === 1 ? "" : "s"} in this program`
          : undefined}
      />

      {programs.length > 1 && (
        <nav className="rise mb-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {programs.map((p) => (
            <Link
              key={p.id}
              href={`/start?program=${p.id}`}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                p.id === program?.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line-2 text-ink-dim"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </nav>
      )}

      {!program || program.days.length === 0 ? (
        <Empty>
          {program ? "This program has no days yet." : "No programs yet."}{" "}
          <Link href="/programs" className="text-accent underline">Build one</Link>, or start
          freestyle below.
        </Empty>
      ) : (
        <ul className="rise rise-1 space-y-3">
          {program.days.map((day, i) => {
            const last = lastUse[day.id];
            const sets = day.exercises.reduce((n, e) => n + e.plannedSets, 0);
            return (
              <li key={day.id}>
                <Panel>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="display tnum text-sm font-semibold text-ink-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <h2 className="display truncate text-2xl font-semibold">{day.name}</h2>
                        <p className="tnum text-[11px] text-ink-faint">
                          {day.exercises.length} lifts · {sets} planned sets
                          {last && ` · last ${new Date(last).toLocaleDateString(undefined, {
                            weekday: "short", day: "numeric", month: "short",
                          })}`}
                          {!last && " · never trained"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1">
                    {day.exercises.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-baseline justify-between gap-2 border-b border-line/60
                                   pb-1 text-sm last:border-0 last:pb-0"
                      >
                        <span className="min-w-0 truncate">{e.name}</span>
                        <span className="tnum shrink-0 text-xs text-ink-faint">
                          {e.plannedSets} × {e.plannedReps}
                          <span className="ml-2 text-ink-faint">{e.muscleGroup}</span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <form action={startWorkout.bind(null, day.id)} className="mt-3">
                    <Button type="submit" variant="primary" className="w-full">
                      Start {day.name}
                    </Button>
                  </form>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}

      <form action={startWorkout.bind(null, null)} className="mt-4">
        <Button type="submit" className="w-full">Freestyle — no program</Button>
      </form>
      <p className="mt-2 text-center text-[11px] text-ink-faint">
        Starts an empty session. Add lifts as you go.
      </p>
    </Page>
  );
}
