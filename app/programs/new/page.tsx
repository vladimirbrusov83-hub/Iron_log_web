import { getExercises } from "@/lib/db";
import { ProgramEditor } from "../editor";

export const dynamic = "force-dynamic";

export default async function NewProgramPage() {
  const library = await getExercises();
  return <ProgramEditor program={null} library={library} />;
}
