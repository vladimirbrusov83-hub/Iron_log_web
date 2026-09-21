import { isCountedSet } from "./effective-reps";

export type WeightUnit = "kg" | "lb";

export type Settings = {
  weightUnit: WeightUnit;
  defaultRestSeconds: number;
  trackRir: boolean;
};

export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  isCompound: boolean;
  notes: string;
  isPreset: boolean;
};

export type PlannedExercise = {
  id: string;
  exerciseId: string | null;
  name: string;
  muscleGroup: string;
  position: number;
  plannedSets: number;
  plannedReps: number;
};

export type ProgramDay = {
  id: string;
  name: string;
  position: number;
  exercises: PlannedExercise[];
};

export type Program = {
  id: string;
  name: string;
  description: string;
  isPinned: boolean;
  isPreset: boolean;
  days: ProgramDay[];
};

export type SetLog = {
  id: string;
  setNumber: number;
  weight: number;
  reps: number;
  /** null means "not rated". Never -1 — see lib/effective-reps.ts. */
  rir: number | null;
  rpe: number | null;
  notes: string;
  isCompleted: boolean;
  isWarmup: boolean;
};

export type ExerciseLog = {
  id: string;
  exerciseId: string | null;
  name: string;
  muscleGroup: string;
  position: number;
  notes: string;
  plannedSets: number;
  plannedReps: number;
  /** Marked finished for today with the Done button. */
  isDone: boolean;
  sets: SetLog[];
};

export type Session = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  dayName: string;
  programName: string;
  programId: string | null;
  dayId: string | null;
  durationSeconds: number;
  notes: string;
  exercises: ExerciseLog[];
};

export type PersonalRecord = {
  id: string;
  exerciseName: string;
  weight: number;
  reps: number;
  achievedAt: string;
  sessionId: string | null;
};

export type BodyweightEntry = { id: string; date: string; weight: number };

export const MUSCLE_GROUPS = [
  "Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Core", "Other",
] as const;

/** Epley. A single is its own one-rep max, not weight x 1.033. */
export function estimated1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

/** Only counted sets carry volume — warmups, un-ticked rows and anything above
 *  MAX_COUNTED_RIR are worth nothing. See lib/effective-reps.ts. */
export function setVolume(set: SetLog): number {
  return isCountedSet(set) ? set.weight * set.reps : 0;
}

export function sessionVolume(session: Session): number {
  return session.exercises.flatMap((e) => e.sets).reduce((sum, s) => sum + setVolume(s), 0);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
