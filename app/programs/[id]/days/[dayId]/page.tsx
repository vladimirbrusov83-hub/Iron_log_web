import { notFound } from "next/navigation";
import { getExercises, getProgram } from "@/lib/db";
import { DayEditor } from "./day";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: { params: Promise<{ id: string; dayId: string }> }) {
  const { id, dayId } = await params;
  const [program, library] = await Promise.all([getProgram(id), getExercises()]);
  if (!program) notFound();
  const day = program.days.find((d) => d.id === dayId);
  if (!day) notFound();
  return <DayEditor program={program} day={day} library={library} />;
}
