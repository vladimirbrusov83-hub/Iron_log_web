// The preset library and the three preset programs, ported from the iOS app's
// SeedData.swift. Data only — db-push.mjs writes it.

export const EXERCISES = [
  ["Bench Press", "Chest", true], ["Incline Bench Press", "Chest", true],
  ["Incline Dumbbell Press", "Chest", false], ["Dumbbell Fly", "Chest", false],
  ["Cable Fly", "Chest", false], ["Pec Deck", "Chest", false], ["Push Up", "Chest", false],
  ["Deadlift", "Back", true], ["Barbell Row", "Back", true], ["Pull Up", "Back", true],
  ["Chin Up", "Back", false], ["Lat Pulldown", "Back", false], ["Cable Row", "Back", false],
  ["Dumbbell Row", "Back", false], ["Face Pull", "Back", false],
  ["Squat", "Legs", true], ["Front Squat", "Legs", true], ["Leg Press", "Legs", false],
  ["Romanian Deadlift", "Legs", false], ["Leg Curl", "Legs", false],
  ["Leg Extension", "Legs", false], ["Bulgarian Split Squat", "Legs", false],
  ["Hip Thrust", "Legs", false], ["Calf Raise", "Legs", false],
  ["Overhead Press", "Shoulders", true], ["Dumbbell Shoulder Press", "Shoulders", false],
  ["Lateral Raise", "Shoulders", false], ["Front Raise", "Shoulders", false],
  ["Rear Delt Fly", "Shoulders", false], ["Arnold Press", "Shoulders", false],
  ["Barbell Curl", "Biceps", false], ["Dumbbell Curl", "Biceps", false],
  ["Hammer Curl", "Biceps", false], ["Preacher Curl", "Biceps", false],
  ["Cable Curl", "Biceps", false],
  ["Tricep Pushdown", "Triceps", false], ["Skull Crusher", "Triceps", false],
  ["Overhead Tricep Extension", "Triceps", false], ["Dips", "Triceps", false],
  ["Close Grip Bench Press", "Triceps", true],
  ["Plank", "Core", false], ["Ab Wheel Rollout", "Core", false],
  ["Hanging Leg Raise", "Core", false], ["Cable Crunch", "Core", false],
  ["Russian Twist", "Core", false],
];

// [exercise name, sets, reps]
export const PROGRAMS = [
  {
    name: "Full Body 3x/Week",
    description: "Train your whole body three times per week. Good for beginners and intermediates.",
    days: [
      ["Full Body A", [["Squat", 3, 8], ["Bench Press", 3, 8], ["Barbell Row", 3, 8],
                       ["Overhead Press", 3, 10], ["Dumbbell Curl", 2, 12]]],
      ["Full Body B", [["Deadlift", 3, 6], ["Incline Bench Press", 3, 10], ["Pull Up", 3, 8],
                       ["Lateral Raise", 3, 15], ["Tricep Pushdown", 2, 12]]],
      ["Full Body C", [["Front Squat", 3, 8], ["Dumbbell Fly", 3, 12], ["Cable Row", 3, 10],
                       ["Dumbbell Shoulder Press", 3, 10], ["Barbell Curl", 2, 10]]],
    ],
  },
  {
    name: "Upper / Lower 4x/Week",
    description: "Classic upper/lower split. Four training days per week.",
    days: [
      ["Upper A", [["Bench Press", 4, 6], ["Barbell Row", 4, 6], ["Overhead Press", 3, 8],
                   ["Lat Pulldown", 3, 10], ["Tricep Pushdown", 3, 12], ["Barbell Curl", 3, 12]]],
      ["Lower A", [["Squat", 4, 6], ["Romanian Deadlift", 3, 10], ["Leg Press", 3, 12],
                   ["Leg Curl", 3, 12], ["Calf Raise", 4, 15]]],
      ["Upper B", [["Incline Bench Press", 4, 8], ["Cable Row", 4, 10],
                   ["Dumbbell Shoulder Press", 3, 10], ["Pull Up", 3, 8],
                   ["Skull Crusher", 3, 10], ["Hammer Curl", 3, 12]]],
      ["Lower B", [["Deadlift", 4, 5], ["Bulgarian Split Squat", 3, 10], ["Leg Extension", 3, 12],
                   ["Hip Thrust", 3, 10], ["Calf Raise", 4, 15]]],
    ],
  },
  {
    name: "Push / Pull / Legs 6x/Week",
    description: "High frequency PPL for intermediate to advanced lifters.",
    days: [
      ["Push A", [["Bench Press", 4, 6], ["Incline Dumbbell Press", 3, 10], ["Cable Fly", 3, 12],
                  ["Overhead Press", 3, 8], ["Lateral Raise", 4, 15], ["Tricep Pushdown", 3, 12]]],
      ["Pull A", [["Deadlift", 4, 5], ["Barbell Row", 4, 8], ["Pull Up", 3, 8],
                  ["Lat Pulldown", 3, 10], ["Face Pull", 3, 15], ["Barbell Curl", 3, 10]]],
      ["Legs A", [["Squat", 4, 6], ["Romanian Deadlift", 3, 10], ["Leg Press", 3, 12],
                  ["Leg Curl", 3, 12], ["Calf Raise", 4, 15]]],
      ["Push B", [["Incline Bench Press", 4, 8], ["Dumbbell Fly", 3, 12],
                  ["Dumbbell Shoulder Press", 3, 10], ["Rear Delt Fly", 3, 15],
                  ["Skull Crusher", 3, 10], ["Dips", 3, 10]]],
      ["Pull B", [["Barbell Row", 4, 6], ["Chin Up", 3, 8], ["Dumbbell Row", 3, 10],
                  ["Cable Row", 3, 12], ["Preacher Curl", 3, 10], ["Hammer Curl", 3, 12]]],
      ["Legs B", [["Front Squat", 4, 6], ["Bulgarian Split Squat", 3, 10], ["Leg Press", 3, 15],
                  ["Leg Curl", 3, 10], ["Calf Raise", 4, 15], ["Ab Wheel Rollout", 3, 10]]],
    ],
  },
];
