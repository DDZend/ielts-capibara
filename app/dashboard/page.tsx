import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getLatestAssessmentForEmail } from "../../db";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My dashboard | IELTS Mastery",
  description: "Your personal IELTS study plan, progress and Capi Coach guidance.",
};

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  const row = await getLatestAssessmentForEmail(user.email);
  const latest = row ? {
    id: row.id,
    userName: row.userName,
    targetBand: row.targetBand,
    examTiming: row.examTiming,
    currentLevel: row.currentLevel,
    weeklyHours: row.weeklyHours,
    overallBand: row.overallBand,
    speakingBand: row.speakingBand,
    writingBand: row.writingBand,
    readingBand: row.readingBand,
    listeningBand: row.listeningBand,
    prioritySkill: row.prioritySkill as "Speaking" | "Writing" | "Reading" | "Listening",
    strengthSkill: row.strengthSkill as "Speaking" | "Writing" | "Reading" | "Listening",
    readingCorrect: row.readingCorrect,
    listeningCorrect: row.listeningCorrect,
    writingWords: row.writingWords,
    speakingConfidence: row.speakingConfidence,
    createdAt: row.createdAt,
  } : null;
  return <DashboardClient userName={user.displayName} latest={latest} />;
}
