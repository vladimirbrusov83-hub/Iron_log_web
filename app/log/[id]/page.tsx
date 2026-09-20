import { notFound, redirect } from "next/navigation";
import { getExercises, getSession, getSettings } from "@/lib/db";
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
  const [settings, library] = await Promise.all([getSettings(), getExercises()]);

  return <Workout session={session} settings={settings} library={library} />;
}
