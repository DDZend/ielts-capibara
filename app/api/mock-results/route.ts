import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureAppSchema, getDb } from "../../../db";
import { mockResults } from "../../../db/schema";
import { isMockPayload } from "../../../lib/mock";
import { weekStart } from "../../../lib/study-plan";

export const dynamic = "force-dynamic";

const safeMock = (row: typeof mockResults.$inferSelect) => ({
  id: row.id,
  weekStart: row.weekStart,
  overallBand: row.overallBand,
  speakingBand: row.speakingBand,
  writingBand: row.writingBand,
  readingBand: row.readingBand,
  listeningBand: row.listeningBand,
  prioritySkill: row.prioritySkill,
  strengthSkill: row.strengthSkill,
  readingCorrect: row.readingCorrect,
  listeningCorrect: row.listeningCorrect,
  writingWords: row.writingWords,
  speakingConfidence: row.speakingConfidence,
  createdAt: row.createdAt,
});

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  await ensureAppSchema();
  const results = await getDb().select().from(mockResults)
    .where(eq(mockResults.userEmail, user.email))
    .orderBy(desc(mockResults.createdAt)).limit(8);
  return NextResponse.json({ results: results.map(safeMock) });
}

export async function POST(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!isMockPayload(body) || body.readingCorrect < 0 || body.readingCorrect > 5 || body.listeningCorrect < 0 || body.listeningCorrect > 5 || body.writingWords < 80 || body.speakingConfidence < 1 || body.speakingConfidence > 5) {
    return NextResponse.json({ error: "Invalid mock result" }, { status: 400 });
  }
  await ensureAppSchema();
  const currentWeek = weekStart();
  const existing = (await getDb().select().from(mockResults).where(and(
    eq(mockResults.userEmail, user.email),
    eq(mockResults.weekStart, currentWeek),
  )).limit(1))[0];
  if (!existing) {
    await getDb().insert(mockResults).values({
      userEmail: user.email,
      userName: user.displayName,
      weekStart: currentWeek,
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
      createdAt: new Date().toISOString(),
    });
  }
  const latest = await getDb().select().from(mockResults)
    .where(eq(mockResults.userEmail, user.email))
    .orderBy(desc(mockResults.createdAt)).limit(2);
  return NextResponse.json({ current: safeMock(latest[0]), previous: latest[1] ? safeMock(latest[1]) : null, duplicate: Boolean(existing) }, { status: existing ? 200 : 201 });
}
