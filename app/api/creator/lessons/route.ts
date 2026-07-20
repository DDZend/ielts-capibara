import { NextResponse } from "next/server";
import { getApiCreatorUser } from "../../../creator-auth";
import { COURSE_CATALOG, isCourseModule } from "../../../../lib/course-catalog";
import type { LessonStatus } from "../../../../lib/creator-content";
import type { CourseExercise, ExerciseCategory, ExercisePair } from "../../../../lib/exercise-types";
import { isExerciseType } from "../../../../lib/exercise-types";
import {
  ensureCreatorCatalog,
  getCreatorLessons,
  reorderCreatorLessons,
  updateCreatorLesson,
} from "../../../../db/creator";

export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function cleanList(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanExerciseText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanExerciseList(value: unknown, maxItems: number, maxLength = 300) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function cleanPairs(value: unknown): ExercisePair[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const pair = item as Record<string, unknown>;
    const left = cleanExerciseText(pair.left, 300);
    const right = cleanExerciseText(pair.right, 300);
    return left && right ? [{ left, right }] : [];
  }).slice(0, 40);
}

function cleanCategories(value: unknown): ExerciseCategory[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const category = item as Record<string, unknown>;
    const name = cleanExerciseText(category.name, 120);
    const items = cleanExerciseList(category.items, 40);
    return name && items.length ? [{ name, items }] : [];
  }).slice(0, 15);
}

function cleanExercises(value: unknown): CourseExercise[] | null {
  if (!Array.isArray(value) || value.length > 40) return null;
  const exercises: CourseExercise[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    if (!isExerciseType(item.type)) return null;
    const title = cleanExerciseText(item.title, 120);
    const prompt = cleanExerciseText(item.prompt, 3_000);
    if (!title || !prompt) return null;
    const options = cleanExerciseList(item.options, 40);
    const correctAnswers = cleanExerciseList(item.correctAnswers, 40);
    const pairs = cleanPairs(item.pairs);
    const categories = cleanCategories(item.categories);
    if ((item.type === "single-choice" || item.type === "multiple-choice") && (options.length < 2 || !correctAnswers.length || correctAnswers.some((answer) => !options.includes(answer)))) return null;
    if (item.type === "single-choice" && correctAnswers.length !== 1) return null;
    if (item.type === "matching" && pairs.length < 2) return null;
    if (item.type === "categorisation" && categories.length < 2) return null;
    if (item.type === "ordering" && options.length < 2) return null;
    if ((item.type === "fill-gap" || item.type === "short-answer") && !correctAnswers.length) return null;
    if (item.type === "true-false-not-given" && !["True", "False", "Not Given"].includes(correctAnswers[0] ?? "")) return null;
    if (item.type === "yes-no-not-given" && !["Yes", "No", "Not Given"].includes(correctAnswers[0] ?? "")) return null;
    const rawMaxWords = typeof item.maxWords === "number" ? Math.round(item.maxWords) : null;
    const rawRecordingSeconds = typeof item.recordingSeconds === "number" ? Math.round(item.recordingSeconds) : null;
    exercises.push({
      id: typeof item.id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(item.id) ? item.id : `exercise-${index + 1}`,
      type: item.type,
      title,
      instruction: cleanExerciseText(item.instruction, 1_000),
      prompt,
      options,
      correctAnswers,
      pairs,
      categories,
      sampleAnswer: cleanExerciseText(item.sampleAnswer, 20_000),
      maxWords: rawMaxWords === null ? null : Math.min(5_000, Math.max(10, rawMaxWords)),
      recordingSeconds: rawRecordingSeconds === null ? null : Math.min(600, Math.max(10, rawRecordingSeconds)),
    });
  }
  return exercises;
}

function isLessonStatus(value: unknown): value is LessonStatus {
  return value === "published" || value === "draft" || value === "hidden";
}

export async function GET() {
  const auth = await getApiCreatorUser("content");
  if (!auth.user) return errorResponse(auth.status === 401 ? "Sign in required." : "Teacher access required.", auth.status);
  await ensureCreatorCatalog(auth.user.email);
  return NextResponse.json({ lessons: await getCreatorLessons() });
}

export async function PUT(request: Request) {
  const auth = await getApiCreatorUser("content");
  if (!auth.user) return errorResponse(auth.status === 401 ? "Sign in required." : "Teacher access required.", auth.status);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return errorResponse("Send valid JSON.", 400);
  }
  if (!isCourseModule(body.module) || typeof body.lessonId !== "string") return errorResponse("Choose a valid lesson.", 400);
  const knownLesson = COURSE_CATALOG.some((lesson) => lesson.module === body.module && lesson.id === body.lessonId);
  if (!knownLesson) return errorResponse("That lesson is not in the course catalog.", 404);
  if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 120) return errorResponse("Use a title between 1 and 120 characters.", 400);
  if (!isLessonStatus(body.status)) return errorResponse("Choose published, draft, or hidden.", 400);
  const vocabulary = cleanList(body.vocabulary, 50);
  const exercises = cleanExercises(body.exercises);
  const answerKey = cleanList(body.answerKey, 50);
  if (!vocabulary || !exercises || !answerKey) return errorResponse("Check the exercise fields, answer settings, and material lists.", 400);
  if (typeof body.transcript !== "string" || body.transcript.length > 60_000) return errorResponse("The transcript is too long.", 400);
  await ensureCreatorCatalog(auth.user.email);
  const lesson = await updateCreatorLesson({
    module: body.module,
    lessonId: body.lessonId,
    title: body.title.trim(),
    status: body.status,
    vocabulary,
    exercises,
    transcript: body.transcript.trim(),
    answerKey,
    updatedBy: auth.user.email,
  });
  return NextResponse.json({ lesson });
}

export async function PATCH(request: Request) {
  const auth = await getApiCreatorUser("content");
  if (!auth.user) return errorResponse(auth.status === 401 ? "Sign in required." : "Teacher access required.", auth.status);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return errorResponse("Send valid JSON.", 400);
  }
  if (!isCourseModule(body.module) || !Array.isArray(body.lessonIds)) return errorResponse("Choose a valid module and lesson order.", 400);
  const lessonIds = body.lessonIds.filter((id): id is string => typeof id === "string");
  const expected = COURSE_CATALOG.filter((lesson) => lesson.module === body.module).map((lesson) => lesson.id);
  if (lessonIds.length !== expected.length || new Set(lessonIds).size !== expected.length || expected.some((id) => !lessonIds.includes(id))) {
    return errorResponse("The order must include every lesson in the module exactly once.", 400);
  }
  await ensureCreatorCatalog(auth.user.email);
  return NextResponse.json({ lessons: await reorderCreatorLessons(body.module, lessonIds, auth.user.email) });
}
