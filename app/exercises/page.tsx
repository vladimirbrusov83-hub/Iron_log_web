import { getExercises } from "@/lib/db";
import { Library } from "./library";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const exercises = await getExercises();
  return <Library exercises={exercises} />;
}
