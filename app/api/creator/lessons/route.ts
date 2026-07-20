import { NextResponse } from "next/server";
import { getApiCreatorUser } from "../../../creator-auth";
import { COURSE_CATALOG, isCourseModule } from "../../../../lib/course-catalog";
import type { LessonStatus } from "../../../../lib/creator-content";
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

function isLessonStatus(value: unknown): value is LessonStatus {
  return value === "published" || value === "draft" || value === "hidden";
}

export async function GET() {
  const auth = await getApiCreatorUser();
  if (!auth.user) return errorResponse(auth.status === 401 ? "Sign in required." : "Teacher access required.", auth.status);
  await ensureCreatorCatalog(auth.user.email);
  return NextResponse.json({ lessons: await getCreatorLessons() });
}

export async function PUT(request: Request) {
  const auth = await getApiCreatorUser();
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
  const exercises = cleanList(body.exercises, 50);
  const answerKey = cleanList(body.answerKey, 50);
  if (!vocabulary || !exercises || !answerKey) return errorResponse("Vocabulary, exercises, and answer keys must be lists.", 400);
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
  const auth = await getApiCreatorUser();
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
