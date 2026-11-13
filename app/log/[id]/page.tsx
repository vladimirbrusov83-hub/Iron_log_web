import { notFound, redirect } from "next/navigation";
import { getExercises, getLastWeekMuscleTotals, getPreviousSession, getSession, getSettings } from "@/lib/db";
import { effectiveRepsByMuscle } from "@/lib/effective-reps";
import { Workout } from "./workout";

export const dynamic = "force-dynamic";

export default async function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  // A finished session is read-only; its page is the history entry.
  if (session.finishedAt) redirect(`/history/${id}`);

  // Last session's sets are not loaded here any more — they belong to one lift,
  // and that is a screen of its own now.
  const [settings, library, previous, lastWeek, thisWeek] = await Promise.all([
    getSettings(), getExercises(), getPreviousSession(session),
    getLastWeekMuscleTotals(), getLastWeekMuscleTotals(0, session.id),
  ]);
  // The muscles this workout trains, main then helpers, in lift order — the
  // ⋯ panel's week tabs show those, zeros included, not every muscle.
  const trained = [...new Set(session.exercises.flatMap((e) => [e.muscleGroup, ...e.secondaryMuscles]))];
  const weekRows = (w: typeof lastWeek) => ({
    weekStart: w.weekStart,
    rows: trained.map((m) => w.rows.find((r) => r.muscleGroup === m)
      ?? { muscleGroup: m, workingSets: 0, hardSets: 0, effectiveReps: 0, sessions: 0 }),
  });

  return (
    <Workout
      session={session}
      settings={settings}
      library={library}
      previous={previous && {
        dayName: previous.dayName,
        startedAt: previous.startedAt,
        byMuscle: effectiveRepsByMuscle(previous.exercises),
      }}
      lastWeek={weekRows(lastWeek)}
      thisWeek={weekRows(thisWeek)}
    />
  );
}
