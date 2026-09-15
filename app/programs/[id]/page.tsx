import { notFound } from "next/navigation";
import { getExercises, getProgram } from "@/lib/db";
import { ProgramEditor } from "../editor";

export const dynamic = "force-dynamic";

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [program, library] = await Promise.all([getProgram(id), getExercises()]);
  if (!program) notFound();
  return <ProgramEditor program={program} library={library} />;
}
