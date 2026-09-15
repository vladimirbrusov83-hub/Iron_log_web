"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { MAX_RIR } from "@/lib/effective-reps";
import type { ProgramInput } from "@/lib/db";
import type { Settings, WeightUnit } from "@/lib/types";

/* Every action below is reachable by anything that can reach the app, so each
   one re-derives what it is allowed to touch rather than trusting its arguments.
   There is only one person behind the passcode, so "allowed" here means well-
   formed and in range, not who-owns-what. */

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/* --------------------------------------------------------------- sessions */

export async function startWorkout(dayId: string | null) {
  const id = await db.startSession(dayId || null);
  revalidatePath("/");
  redirect(`/log/${id}`);
}

export async function finishWorkout(sessionId: string) {
  await db.finishSession(sessionId);
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/stats");
  redirect(`/history/${sessionId}`);
}

export async function discardWorkout(sessionId: string) {
  await db.deleteSession(sessionId);
  revalidatePath("/");
  redirect("/");
}

export async function removeSession(sessionId: string) {
  await db.deleteSession(sessionId);
  revalidatePath("/history");
  revalidatePath("/stats");
  redirect("/history");
}

export async function addExercise(
  sessionId: string, exerciseId: string | null, name: string, muscleGroup: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.addExerciseToSession(sessionId, exerciseId || null, trimmed, muscleGroup || "Other");
  revalidatePath(`/log/${sessionId}`);
}

export async function dropExercise(sessionId: string, logId: string) {
  await db.removeExerciseLog(logId);
  revalidatePath(`/log/${sessionId}`);
}

export async function noteExercise(sessionId: string, logId: string, notes: string) {
  await db.saveExerciseLogNotes(logId, notes.slice(0, 2000));
  revalidatePath(`/log/${sessionId}`);
}

export async function noteSession(sessionId: string, notes: string) {
  await db.saveSessionNotes(sessionId, notes.slice(0, 4000));
  revalidatePath(`/log/${sessionId}`);
}

/* ------------------------------------------------------------------- sets */

/**
 * Records one performed set from the set sheet — the only way sets are entered
 * on the gym screen now.
 *
 * `setId` is an existing row when the workout came from a program day, which
 * lays out its planned sets in advance; the sheet fills the first one that has
 * not been done yet rather than leaving a blank row behind and appending beside
 * it. When there is no such row the set is inserted outright. Either way the
 * weight, reps, rating and the completed flag go up in one write, so nothing
 * can land half-saved.
 */
export async function logSet(
  sessionId: string,
  logId: string,
  setId: string | null,
  values: { weight: number; reps: number; rir: number | null; isWarmup: boolean },
) {
  const clean = {
    weight: clampNumber(values.weight, 0, 999, 0),
    reps: Math.round(clampNumber(values.reps, 0, 500, 0)),
    rir: values.rir === null || values.rir === undefined
      ? null
      : Math.round(clampNumber(values.rir, 0, MAX_RIR, 0)),
    isWarmup: Boolean(values.isWarmup),
  };

  if (setId) await db.updateSet(setId, { ...clean, isCompleted: true });
  else await db.insertCompletedSet(logId, clean);

  revalidatePath(`/log/${sessionId}`);
}

export async function removeSet(sessionId: string, setId: string) {
  await db.deleteSet(setId);
  revalidatePath(`/log/${sessionId}`);
}

/* --------------------------------------------------------------- programs */

export async function saveProgramAction(draft: ProgramInput) {
  const name = draft.name.trim() || "Untitled program";
  const days = draft.days
    .map((d) => ({
      name: d.name.trim() || "Day",
      exercises: d.exercises
        .filter((e) => e.name.trim() !== "")
        .map((e) => ({
          exerciseId: e.exerciseId || null,
          name: e.name.trim(),
          muscleGroup: e.muscleGroup || "Other",
          plannedSets: Math.round(clampNumber(e.plannedSets, 1, 20, 3)),
          plannedReps: Math.round(clampNumber(e.plannedReps, 1, 100, 10)),
        })),
    }))
    .filter((d) => d.exercises.length > 0);

  const id = await db.saveProgram({ ...draft, name, days });
  revalidatePath("/programs");
  revalidatePath("/");
  redirect(`/programs/${id}`);
}

export async function removeProgram(id: string) {
  await db.deleteProgram(id);
  revalidatePath("/programs");
  revalidatePath("/");
  redirect("/programs");
}

export async function togglePin(id: string, pinned: boolean) {
  if (pinned) await db.unpinProgram(id);
  else await db.pinProgram(id);
  revalidatePath("/programs");
  revalidatePath("/");
}

export async function copyProgram(id: string) {
  const newId = await db.duplicateProgram(id);
  revalidatePath("/programs");
  if (newId) redirect(`/programs/${newId}`);
}

/* -------------------------------------------------------------- exercises */

export async function createExercise(name: string, muscleGroup: string, isCompound: boolean) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Give it a name." };
  const id = await db.addExercise(trimmed, muscleGroup || "Other", isCompound);
  revalidatePath("/exercises");
  if (!id) return { ok: false as const, error: `"${trimmed}" is already in the library.` };
  return { ok: true as const, id };
}

export async function editExercise(
  id: string, name: string, muscleGroup: string, isCompound: boolean, notes: string,
) {
  await db.updateExercise(id, name, muscleGroup, isCompound, notes.slice(0, 2000));
  revalidatePath("/exercises");
}

export async function removeExercise(id: string) {
  await db.deleteExercise(id);
  revalidatePath("/exercises");
}

/* ------------------------------------------------- settings and bodyweight */

export async function saveSettings(settings: Settings) {
  await db.updateSettings({
    weightUnit: (["kg", "lb"].includes(settings.weightUnit)
      ? settings.weightUnit : "kg") as WeightUnit,
    defaultRestSeconds: Math.round(clampNumber(settings.defaultRestSeconds, 10, 600, 90)),
    trackRir: Boolean(settings.trackRir),
  });
  revalidatePath("/settings");
  revalidatePath("/log");
}

export async function logBodyweight(weight: number, date: string) {
  const clean = clampNumber(weight, 1, 600, 0);
  if (clean <= 0) return;
  // A date the browser made up is still a date the browser made up.
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  await db.addBodyweight(clean, day);
  revalidatePath("/stats");
}

export async function removeBodyweight(id: string) {
  await db.deleteBodyweight(id);
  revalidatePath("/stats");
}
