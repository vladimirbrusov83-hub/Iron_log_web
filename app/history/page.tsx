import Link from "next/link";
import { getFinishedSessions, getSettings } from "@/lib/db";
import { Empty, Header, Page } from "@/components/ui";
import { effectiveRepsByMuscle, effectiveRepsCoverage, totalEffectiveReps } from "@/lib/effective-reps";
import { formatDuration, sessionVolume } from "@/lib/types";
import { HistoryList } from "./swipe-row";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [sessions, settings] = await Promise.all([getFinishedSessions(100), getSettings()]);

  const rows = sessions.map((s) => {
    const sets = s.exercises.flatMap((e) => e.sets);
    const coverage = effectiveRepsCoverage(sets);
    const muscles = effectiveRepsByMuscle(s.exercises).slice(0, 3);
    const date = new Date(s.startedAt);
    return {
      id: s.id,
      label: `${s.dayName} · ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      card: (
        <Link
          href={`/history/${s.id}`}
          className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3
                     transition-colors hover:border-line-2"
        >
          <div className="shrink-0 text-center">
            <div className="display text-xl font-semibold leading-none">
              {date.toLocaleDateString(undefined, { day: "numeric" })}
            </div>
            <div className="eyebrow" style={{ fontSize: 9 }}>
              {date.toLocaleDateString(undefined, { month: "short" })}
            </div>
          </div>
          <div className="min-w-0 flex-1 border-l border-line pl-3">
            <h2 className="truncate font-medium">{s.dayName}</h2>
            <p className="tnum truncate text-[11px] text-ink-faint">
              {muscles.length > 0
                ? muscles.map((m) => `${m.muscleGroup} ${m.effectiveReps}`).join(" · ")
                : s.programName || "Freestyle"}
            </p>
            <p className="tnum text-[11px] text-ink-faint">
              {coverage.working} sets · {Math.round(sessionVolume(s)).toLocaleString()}{" "}
              {settings.weightUnit} · {formatDuration(s.durationSeconds)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="display tnum text-2xl font-semibold text-accent">
              {totalEffectiveReps(sets)}
            </div>
            <div className="eyebrow" style={{ fontSize: 9 }}>eff reps</div>
          </div>
        </Link>
      ),
    };
  });

  return (
    <Page>
      <Header
        title="History"
        subtitle={`${sessions.length} finished sessions`}
      />

      {sessions.length === 0 ? (
        <Empty>Finished workouts show up here.</Empty>
      ) : (
        <>
          <HistoryList rows={rows} />
          <p className="mt-3 text-center text-[11px] text-ink-faint">
            Swipe a workout left to delete it.
          </p>
        </>
      )}
    </Page>
  );
}
