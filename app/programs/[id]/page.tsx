import { notFound } from "next/navigation";
import { getProgram } from "@/lib/db";
import { ProgramPage } from "./program";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const program = await getProgram(id);
  if (!program) notFound();
  return <ProgramPage program={program} />;
}
