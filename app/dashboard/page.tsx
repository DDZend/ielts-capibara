import type { Metadata } from "next";
import { requireLearningAccess } from "../learning-access";
import { getDashboardLearningData, getLatestAssessmentForEmail } from "../../db";
import { DashboardClient } from "./DashboardClient";
import { isCreatorEmail } from "../creator-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My dashboard | IELTS Mastery",
  description: "Your personal IELTS study plan, progress and Capy Coach guidance.",
};

export default async function DashboardPage() {
  const user = await requireLearningAccess("/dashboard");
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
  const learning = await getDashboardLearningData(user.email, latest?.prioritySkill ?? "Reading");
  const mocks = learning.mocks.map((mock) => ({
    id: mock.id,
    weekStart: mock.weekStart,
    overallBand: mock.overallBand,
    speakingBand: mock.speakingBand,
    writingBand: mock.writingBand,
    readingBand: mock.readingBand,
    listeningBand: mock.listeningBand,
    prioritySkill: mock.prioritySkill as "Speaking" | "Writing" | "Reading" | "Listening",
    strengthSkill: mock.strengthSkill as "Speaking" | "Writing" | "Reading" | "Listening",
    readingCorrect: mock.readingCorrect,
    listeningCorrect: mock.listeningCorrect,
    writingWords: mock.writingWords,
    speakingConfidence: mock.speakingConfidence,
    createdAt: mock.createdAt,
  }));
  return <DashboardClient userName={user.displayName} isCreator={await isCreatorEmail(user.email)} latest={latest} initialTasks={learning.tasks} recentTasks={learning.recent} initialStats={learning.stats} mocks={mocks} adaptivePriority={learning.adaptivePriority} moduleProgress={learning.moduleProgress} assessmentHistory={learning.assessmentHistory} weeklyReport={learning.weeklyReport} />;
}
