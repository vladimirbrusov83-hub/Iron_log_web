import { notFound, redirect } from "next/navigation";
import { getLastPerformance, getExercises, getSession, getSettings } from "@/lib/db";
import { Workout } from "./workout";

export const dynamic = "force-dynamic";

export default async function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  // A finished session is read-only; its page is the history entry.
  if (session.finishedAt) redirect(`/history/${id}`);

  const [settings, library, last] = await Promise.all([
    getSettings(),
    getExercises(),
    getLastPerformance(session.exercises.map((e) => e.name)),
  ]);

  return (
    <Workout
      session={session}
      settings={settings}
      library={library}
      lastTime={Object.fromEntries(last)}
    />
  );
}
