import { getExerciseUsage, getExercises } from "@/lib/db";
import { Library } from "./library";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const [exercises, usage] = await Promise.all([getExercises(), getExerciseUsage()]);
  return <Library exercises={exercises} usage={usage} />;
}
