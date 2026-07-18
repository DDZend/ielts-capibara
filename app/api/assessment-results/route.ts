import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureAssessmentSchema, getDb } from "../../../db";
import { assessmentResults } from "../../../db/schema";
import { isAssessmentPayload } from "../../../lib/assessment";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  await ensureAssessmentSchema();
  const results = await getDb().select().from(assessmentResults)
    .where(eq(assessmentResults.userEmail, user.email))
    .orderBy(desc(assessmentResults.createdAt)).limit(20);
  return NextResponse.json({ results });
}

export async function POST(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!isAssessmentPayload(body)) return NextResponse.json({ error: "Invalid assessment result" }, { status: 400 });
  if (body.writingWords < 40 || body.readingCorrect < 0 || body.readingCorrect > 3 || body.listeningCorrect < 0 || body.listeningCorrect > 3 || body.speakingConfidence < 1 || body.speakingConfidence > 5) {
    return NextResponse.json({ error: "Assessment values are outside the expected range" }, { status: 400 });
  }
  await ensureAssessmentSchema();
  const recentThreshold = new Date(Date.now() - 5 * 60_000).toISOString();
  const duplicate = (await getDb().select({ id: assessmentResults.id }).from(assessmentResults)
    .where(and(
      eq(assessmentResults.userEmail, user.email),
      eq(assessmentResults.overallBand, body.overallBand),
      eq(assessmentResults.readingCorrect, body.readingCorrect),
      eq(assessmentResults.listeningCorrect, body.listeningCorrect),
      gte(assessmentResults.createdAt, recentThreshold),
    )).limit(1))[0];
  if (duplicate) return NextResponse.json({ id: duplicate.id, saved: true, duplicate: true });
  const createdAt = new Date().toISOString();
  const inserted = await getDb().insert(assessmentResults).values({
    userEmail: user.email,
    userName: user.displayName,
    targetBand: body.targetBand,
    examTiming: body.examTiming,
    currentLevel: body.currentLevel,
    weeklyHours: body.weeklyHours,
    overallBand: body.overallBand,
    speakingBand: body.speakingBand,
    writingBand: body.writingBand,
    readingBand: body.readingBand,
    listeningBand: body.listeningBand,
    prioritySkill: body.prioritySkill,
    strengthSkill: body.strengthSkill,
    readingCorrect: body.readingCorrect,
    listeningCorrect: body.listeningCorrect,
    writingWords: body.writingWords,
    speakingConfidence: body.speakingConfidence,
    createdAt,
  }).returning({ id: assessmentResults.id });
  return NextResponse.json({ id: inserted[0].id, saved: true }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: unknown; targetBand?: unknown } | null;
  if (!body || !Number.isInteger(body.id) || ![6, 6.5, 7, 7.5, 8, 8.5, 9].includes(Number(body.targetBand))) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }
  await ensureAssessmentSchema();
  const updated = await getDb().update(assessmentResults).set({ targetBand: Number(body.targetBand) })
    .where(and(eq(assessmentResults.id, Number(body.id)), eq(assessmentResults.userEmail, user.email)))
    .returning({ id: assessmentResults.id });
  if (!updated.length) return NextResponse.json({ error: "Result not found" }, { status: 404 });
  return NextResponse.json({ updated: true });
}
