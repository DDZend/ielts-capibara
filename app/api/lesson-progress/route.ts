import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { getApiLearningUser } from "../../learning-access";
import { ensureAppSchema, getDb } from "../../../db";
import { lessonProgress } from "../../../db/schema";

export const dynamic = "force-dynamic";

const MODULES = new Set(["Speaking", "Writing", "Reading", "Listening"]);
type ProgressPayload = { module: string; lessonId: string; lessonTitle: string; score: number; correctCount: number; totalCount: number };

function isProgressPayload(value: unknown): value is ProgressPayload {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<ProgressPayload>;
  return typeof body.module === "string" && MODULES.has(body.module)
    && typeof body.lessonId === "string" && /^[a-z0-9-]{2,60}$/.test(body.lessonId)
    && typeof body.lessonTitle === "string" && body.lessonTitle.trim().length >= 2 && body.lessonTitle.length <= 160
    && typeof body.score === "number" && Number.isFinite(body.score) && body.score >= 0 && body.score <= 100
    && Number.isInteger(body.correctCount) && Number(body.correctCount) >= 0
    && Number.isInteger(body.totalCount) && Number(body.totalCount) > 0
    && Number(body.correctCount) <= Number(body.totalCount);
}

export async function GET(request: NextRequest) {
  const access = await getApiLearningUser();
  if (!access.user) return NextResponse.json({ error: access.status === 401 ? "Authentication required" : "Active learning access required" }, { status: access.status });
  const user = access.user;
  const moduleName = request.nextUrl.searchParams.get("module");
  if (moduleName && !MODULES.has(moduleName)) return NextResponse.json({ error: "Invalid module" }, { status: 400 });
  await ensureAppSchema();
  const where = moduleName
    ? and(eq(lessonProgress.userEmail, user.email), eq(lessonProgress.module, moduleName))
    : eq(lessonProgress.userEmail, user.email);
  const progress = await getDb().select().from(lessonProgress).where(where).orderBy(desc(lessonProgress.updatedAt));
  return NextResponse.json({ progress }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  const access = await getApiLearningUser();
  if (!access.user) return NextResponse.json({ error: access.status === 401 ? "Authentication required" : "Active learning access required" }, { status: access.status });
  const user = access.user;
  const body: unknown = await request.json().catch(() => null);
  if (!isProgressPayload(body)) return NextResponse.json({ error: "Invalid lesson result" }, { status: 400 });
  await ensureAppSchema();
  const now = new Date().toISOString();
  const rows = await getDb().insert(lessonProgress).values({
    userEmail: user.email,
    module: body.module,
    lessonId: body.lessonId,
    lessonTitle: body.lessonTitle.trim(),
    status: "completed",
    score: Math.round(body.score),
    correctCount: body.correctCount,
    totalCount: body.totalCount,
    attempts: 1,
    completedAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [lessonProgress.userEmail, lessonProgress.module, lessonProgress.lessonId],
    set: {
      lessonTitle: body.lessonTitle.trim(),
      status: "completed",
      score: Math.round(body.score),
      correctCount: body.correctCount,
      totalCount: body.totalCount,
      attempts: sql`${lessonProgress.attempts} + 1`,
      completedAt: now,
      updatedAt: now,
    },
  }).returning();
  return NextResponse.json({ progress: rows[0] }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
