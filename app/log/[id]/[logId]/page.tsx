import { notFound, redirect } from "next/navigation";
import { getLastSessionSets, getSession, getSettings } from "@/lib/db";
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
  params,
}: {
  params: Promise<{ id: string; logId: string }>;
}) {
  const { id, logId } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  if (session.finishedAt) redirect(`/history/${id}`);

  const index = session.exercises.findIndex((e) => e.id === logId);
  if (index === -1) notFound();
  const log = session.exercises[index];

  const [settings, last] = await Promise.all([
    getSettings(),
    getLastSessionSets([log.name]),
  ]);

  return (
    <ExerciseScreen
      sessionId={session.id}
      dayName={session.dayName}
      log={log}
      index={index}
      total={session.exercises.length}
      settings={settings}
      last={last.get(log.name.toLowerCase())}
    />
  );
}
