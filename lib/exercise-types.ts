export const EXERCISE_TYPES = [
  { id: "single-choice", label: "Choose one", group: "Choice", description: "One correct answer from several options." },
  { id: "multiple-choice", label: "Choose several", group: "Choice", description: "Two or more correct options." },
  { id: "true-false-not-given", label: "True / False / Not Given", group: "IELTS", description: "Check factual claims against a text." },
  { id: "yes-no-not-given", label: "Yes / No / Not Given", group: "IELTS", description: "Check a writer’s views or claims." },
  { id: "matching", label: "Matching pairs", group: "Matching", description: "Match terms, headings, people, or features." },
  { id: "categorisation", label: "Sort into categories", group: "Matching", description: "Assign each item to the correct group." },
  { id: "ordering", label: "Put in order", group: "Sequence", description: "Arrange steps, sentences, or events." },
  { id: "fill-gap", label: "Fill in the gap", group: "Written", description: "Complete a sentence, note, table, or summary." },
  { id: "short-answer", label: "Short answer", group: "Written", description: "Enter a brief answer with accepted alternatives." },
  { id: "paragraph-response", label: "Paragraph response", group: "Extended", description: "Write and compare a developed paragraph." },
  { id: "essay-response", label: "Essay response", group: "Extended", description: "Complete a longer Task 1 or Task 2 response." },
  { id: "speaking-response", label: "Speaking recording", group: "Extended", description: "Record and replay a timed spoken answer." },
] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number]["id"];

export type ExercisePair = { left: string; right: string };
export type ExerciseCategory = { name: string; items: string[] };

export type CourseExercise = {
  id: string;
  type: ExerciseType;
  title: string;
  instruction: string;
  prompt: string;
  options: string[];
  correctAnswers: string[];
  pairs: ExercisePair[];
  categories: ExerciseCategory[];
  sampleAnswer: string;
  maxWords: number | null;
  recordingSeconds: number | null;
};

export function isExerciseType(value: unknown): value is ExerciseType {
  return typeof value === "string" && EXERCISE_TYPES.some((type) => type.id === value);
}

export function createExercise(type: ExerciseType, id = crypto.randomUUID()): CourseExercise {
  const label = EXERCISE_TYPES.find((item) => item.id === type)?.label ?? "Exercise";
  const exercise: CourseExercise = {
    id,
    type,
    title: label,
    instruction: "",
    prompt: "",
    options: [],
    correctAnswers: [],
    pairs: [],
    categories: [],
    sampleAnswer: "",
    maxWords: null,
    recordingSeconds: null,
  };
  if (type === "single-choice" || type === "multiple-choice") exercise.options = ["Option A", "Option B", "Option C"];
  if (type === "single-choice") exercise.correctAnswers = ["Option A"];
  if (type === "multiple-choice") exercise.correctAnswers = ["Option A", "Option B"];
  if (type === "true-false-not-given") exercise.correctAnswers = ["True"];
  if (type === "yes-no-not-given") exercise.correctAnswers = ["Yes"];
  if (type === "matching") exercise.pairs = [{ left: "Item 1", right: "Match A" }, { left: "Item 2", right: "Match B" }];
  if (type === "categorisation") exercise.categories = [{ name: "Group A", items: ["Item 1"] }, { name: "Group B", items: ["Item 2"] }];
  if (type === "ordering") exercise.options = ["First step", "Second step", "Third step"];
  if (type === "fill-gap" || type === "short-answer") exercise.correctAnswers = ["Accepted answer"];
  if (type === "paragraph-response") exercise.maxWords = 150;
  if (type === "essay-response") exercise.maxWords = 350;
  if (type === "speaking-response") exercise.recordingSeconds = 120;
  return exercise;
}
