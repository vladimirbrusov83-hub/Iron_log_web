import Link from "next/link";
import { getFinishedSessions, getSettings } from "@/lib/db";
import { Empty, Header, Page } from "@/components/ui";
import { effectiveRepsCoverage, totalEffectiveReps } from "@/lib/effective-reps";
import { formatDuration, sessionVolume } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [sessions, settings] = await Promise.all([getFinishedSessions(100), getSettings()]);

  return (
    <Page>
      <Header title="History" subtitle={`${sessions.length} finished sessions`} />

      {sessions.length === 0 ? (
        <Empty>Finished workouts show up here.</Empty>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const sets = s.exercises.flatMap((e) => e.sets);
            const coverage = effectiveRepsCoverage(sets);
            return (
              <li key={s.id}>
                <Link
                  href={`/history/${s.id}`}
                  className="block rounded-xl border border-line bg-panel px-4 py-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-medium">{s.dayName}</h2>
                      {s.programName && (
                        <p className="truncate text-[11px] text-ink-faint">{s.programName}</p>
                      )}
                    </div>
                    <span className="tnum shrink-0 text-xs text-ink-faint">
                      {new Date(s.startedAt).toLocaleDateString(undefined, {
                        month: "short", day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="tnum mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    <span className="text-accent">{totalEffectiveReps(sets)} eff reps</span>
                    <span className="text-ink-faint">
                      {Math.round(sessionVolume(s)).toLocaleString()} {settings.weightUnit}
                    </span>
                    <span className="text-ink-faint">{coverage.working} sets</span>
                    <span className="text-ink-faint">{formatDuration(s.durationSeconds)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
