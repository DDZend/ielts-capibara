import type { Metadata } from "next";
import { requireLearningAccess } from "../learning-access";
import { getMockResultsForEmail } from "../../db";
import type { SavedMock } from "../../lib/mock";
import { MockTestClient } from "./MockTestClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Weekend Mock Challenge | IELTS Mastery",
  description: "Complete a four-skill IELTS practice mock and compare your learning estimate with last week.",
};

export default async function MockTestPage() {
  const user = await requireLearningAccess("/mock-test");
  const rows = await getMockResultsForEmail(user.email, 2);
  const mocks: SavedMock[] = rows.map((row) => ({
    id: row.id,
    weekStart: row.weekStart,
    overallBand: row.overallBand,
    speakingBand: row.speakingBand,
    writingBand: row.writingBand,
    readingBand: row.readingBand,
    listeningBand: row.listeningBand,
    prioritySkill: row.prioritySkill as SavedMock["prioritySkill"],
    strengthSkill: row.strengthSkill as SavedMock["strengthSkill"],
    readingCorrect: row.readingCorrect,
    listeningCorrect: row.listeningCorrect,
    writingWords: row.writingWords,
    speakingConfidence: row.speakingConfidence,
    createdAt: row.createdAt,
  }));
  return <MockTestClient existingMocks={mocks} userName={user.displayName} />;
}
