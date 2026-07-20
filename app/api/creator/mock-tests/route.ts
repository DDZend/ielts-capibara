import { NextResponse } from "next/server";
import { getApiCreatorUser } from "../../../creator-auth";
import { ensureCreatorCatalog, getCreatorLessons } from "../../../../db/creator";
import { createMockVersion, ensureMockCatalog, getTeacherMockDashboard, moderateMockAssessment, setMockVersionStatus } from "../../../../db/mock-engine";
import { DEFAULT_MOCK_DURATIONS, MOCK_SKILLS, type MockExamItem, type MockSkill } from "../../../../lib/mock-engine";

export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function library(teacherEmail: string) {
  await ensureCreatorCatalog(teacherEmail);
  const lessons = await getCreatorLessons();
  return lessons.flatMap((lesson) => lesson.exercises.map((exercise) => ({
    ref: `${lesson.module}:${lesson.lessonId}:${exercise.id}`,
    module: lesson.module,
    lessonId: lesson.lessonId,
    lessonTitle: lesson.title,
    exerciseId: exercise.id,
    title: exercise.title,
    prompt: exercise.prompt,
    type: exercise.type,
    hasAudio: Boolean(lesson.audioMediaId),
    published: lesson.status === "published",
  })));
}

export async function GET() {
  const auth = await getApiCreatorUser("mocks");
  if (!auth.user) return json({ error: auth.status === 401 ? "Sign in required." : "Teacher access required." }, auth.status);
  await ensureMockCatalog(auth.user.email);
  return json({ dashboard: await getTeacherMockDashboard(), library: await library(auth.user.email) });
}

function cleanDuration(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(180, Math.max(5, Math.round(value))) : fallback;
}

export async function POST(request: Request) {
  const auth = await getApiCreatorUser("mocks");
  if (!auth.user) return json({ error: auth.status === 401 ? "Sign in required." : "Teacher access required." }, auth.status);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.title !== "string" || !body.title.trim() || body.title.length > 140
    || typeof body.label !== "string" || !body.label.trim() || body.label.length > 80
    || !Array.isArray(body.refs) || !body.refs.length || body.refs.length > 160) return json({ error: "Add a title, version label and at least one library question." }, 400);
  const status = body.status === "published" ? "published" : "draft";
  const lessons = await getCreatorLessons();
  const refs = body.refs.filter((value): value is string => typeof value === "string");
  const items: MockExamItem[] = [];
  for (let index = 0; index < refs.length; index += 1) {
    const [module, lessonId, exerciseId] = refs[index].split(":");
    const lesson = lessons.find((entry) => entry.module === module && entry.lessonId === lessonId);
    const exercise = lesson?.exercises.find((entry) => entry.id === exerciseId);
    if (!lesson || !exercise) return json({ error: "One selected question no longer exists in Creator Studio." }, 409);
    const skill = lesson.module as MockSkill;
    const skillIndex = items.filter((item) => item.skill === skill).length;
    items.push({
      ...exercise,
      key: `v-${Date.now()}-${index + 1}-${exercise.id}`.slice(0, 120),
      skill,
      lessonId: lesson.lessonId,
      lessonTitle: lesson.title,
      sourceText: skill === "Reading" ? lesson.transcript : "",
      audioMediaId: skill === "Listening" ? lesson.audioMediaId : null,
      listeningScript: skill === "Listening" ? lesson.transcript : "",
      part: skill === "Writing" ? Math.min(2, skillIndex + 1) : skill === "Speaking" ? Math.min(3, skillIndex + 1) : null,
    });
  }
  const counts = Object.fromEntries(MOCK_SKILLS.map((skill) => [skill, items.filter((item) => item.skill === skill).length])) as Record<MockSkill, number>;
  if (status === "published" && MOCK_SKILLS.some((skill) => counts[skill] === 0)) return json({ error: "A published mock needs content for all four skills." }, 400);
  const durationsBody = body.durations && typeof body.durations === "object" ? body.durations as Record<string, unknown> : {};
  try {
    await createMockVersion({
      teacherEmail: auth.user.email,
      testId: Number.isInteger(body.testId) ? Number(body.testId) : null,
      title: body.title.trim(),
      description: typeof body.description === "string" ? body.description.trim().slice(0, 500) : "",
      label: body.label.trim(),
      status,
      durations: {
        Reading: cleanDuration(durationsBody.Reading, DEFAULT_MOCK_DURATIONS.Reading),
        Listening: cleanDuration(durationsBody.Listening, DEFAULT_MOCK_DURATIONS.Listening),
        Writing: cleanDuration(durationsBody.Writing, DEFAULT_MOCK_DURATIONS.Writing),
        Speaking: cleanDuration(durationsBody.Speaking, DEFAULT_MOCK_DURATIONS.Speaking),
      },
      items,
    });
    return json({ dashboard: await getTeacherMockDashboard() }, 201);
  } catch (error) {
    return json({ error: error instanceof Error && error.message.includes("UNIQUE") ? "That version label already exists for this test." : error instanceof Error ? error.message : "Could not save the mock version." }, 400);
  }
}

export async function PATCH(request: Request) {
  const auth = await getApiCreatorUser("mocks");
  if (!auth.user) return json({ error: auth.status === 401 ? "Sign in required." : "Teacher access required." }, auth.status);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return json({ error: "Choose an action." }, 400);
  try {
    if (body.action === "status") {
      if (!Number.isInteger(body.versionId) || !["draft", "published", "hidden"].includes(String(body.status))) return json({ error: "Invalid version status." }, 400);
      await setMockVersionStatus(auth.user.email, Number(body.versionId), body.status as "draft" | "published" | "hidden");
    } else if (body.action === "moderate") {
      const band = typeof body.band === "number" ? Math.round(body.band * 2) / 2 : 0;
      if (!Number.isInteger(body.attemptId) || typeof body.itemKey !== "string" || band < 1 || band > 9 || typeof body.comment !== "string" || body.comment.length > 1000) return json({ error: "Choose a valid half-band score and comment." }, 400);
      await moderateMockAssessment({ attemptId: Number(body.attemptId), itemKey: body.itemKey, band, comment: body.comment.trim() });
    } else return json({ error: "Unsupported action." }, 400);
    return json({ dashboard: await getTeacherMockDashboard() });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not update the mock test." }, 400);
  }
}
