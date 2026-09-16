import Link from "next/link";
import { redirect } from "next/navigation";
import { startWorkout } from "@/app/actions";
import { getActiveSession, getLastDayUse, getProgramsByRecentUse } from "@/lib/db";
import { Button, Empty, Header, Page } from "@/components/ui";

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
        /* One compact row per day: what it is called, how many lifts, when it
           was last trained, and which lifts. Sets and reps belong in the editor
           and on the gym screen, not in a list you are scanning to pick from. */
        <ul className="rise rise-1 space-y-2">
          {program.days.map((day, i) => {
            const last = lastUse[day.id];
            return (
              <li key={day.id}>
                <form action={startWorkout.bind(null, day.id)}>
                  <button
                    className="flex w-full items-center gap-3 rounded-2xl border border-line
                               bg-panel px-3 py-3 text-left transition-colors
                               hover:border-accent/60 active:bg-panel-2"
                  >
                    <span className="display tnum w-7 shrink-0 text-2xl font-semibold text-ink-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="display block truncate text-xl font-semibold">
                        {day.name}
                      </span>
                      <span className="tnum block truncate text-[11px] text-ink-faint">
                        {day.exercises.length} lifts
                        {last
                          ? ` · last ${new Date(last).toLocaleDateString(undefined, {
                              day: "numeric", month: "short",
                            })}`
                          : " · never trained"}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-dim">
                        {day.exercises.map((e) => e.name).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-accent">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                           stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                           strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                    </span>
                  </button>
                </form>
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
