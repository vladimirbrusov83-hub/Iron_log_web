import { notFound, redirect } from "next/navigation";
import {
  getExerciseNote, getLastSessionSets, getLiftSessions, getLiftSetsInSession,
  getPreviousSession, getSession, getSettings,
} from "@/lib/db";
import { effectiveRepsByMuscle } from "@/lib/effective-reps";
import { ExerciseScreen } from "./exercise";

export const dynamic = "force-dynamic";

/**
 * One lift of a live session — where sets are actually tracked.
 *
 * It is reached by tapping a row on `/log/[id]`, but it is a real page and can
 * be landed on directly (a back button, a restored tab), so it repeats the
 * finished-session guard rather than trusting the list screen to have run it.
 */
export default async function ExerciseLogPage({
  params, searchParams,
}: {
  params: Promise<{ id: string; logId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id, logId } = await params;
  // `?from=<session id>` swaps the left column to a workout picked from the
  // lift's history instead of the most recent one. Anything that is not a
  // uuid is ignored rather than handed to Postgres.
  const { from } = await searchParams;
  const fromId = from && /^[0-9a-f-]{36}$/i.test(from) ? from : null;
  const session = await getSession(id);
  if (!session) notFound();
  if (session.finishedAt) redirect(`/history/${id}`);

  const index = session.exercises.findIndex((e) => e.id === logId);
  if (index === -1) notFound();
  const log = session.exercises[index];

  const [settings, latest, picked, liftSessions, note, previous] = await Promise.all([
    getSettings(),
    getLastSessionSets([log.name]),
    fromId ? getLiftSetsInSession(log.name, fromId) : Promise.resolve(undefined),
    getLiftSessions(log.name),
    getExerciseNote(log.name),
    getPreviousSession(session),
  ]);
  const last = picked ?? latest.get(log.name.toLowerCase());

  return (
    <ExerciseScreen
      sessionId={session.id}
      dayName={session.dayName}
      startedAt={session.startedAt}
      log={log}
      index={index}
      total={session.exercises.length}
      settings={settings}
      last={last}
      lastId={picked ? fromId : null}
      liftSessions={liftSessions}
      note={note}
      byMuscle={effectiveRepsByMuscle(session.exercises)}
      previous={previous && {
        dayName: previous.dayName,
        startedAt: previous.startedAt,
        byMuscle: effectiveRepsByMuscle(previous.exercises),
      }}
      muscleShared={session.exercises.some((e) =>
        e.id !== log.id && e.muscleGroup === log.muscleGroup && e.sets.some((s) => s.isCompleted))}
    />
  );
}
