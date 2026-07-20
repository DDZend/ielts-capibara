import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import * as schema from "./schema";
import type { Skill } from "../lib/assessment";
import { createDailyPlan, isoDate, weekEnd, weekStart } from "../lib/study-plan";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export function getD1() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return env.DB;
}

let schemaReady: Promise<void> | null = null;

export function ensureAppSchema() {
  schemaReady ??= getD1()
    .batch([
      getD1().prepare(`CREATE TABLE IF NOT EXISTS assessment_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        user_name TEXT NOT NULL,
        target_band REAL NOT NULL,
        exam_timing TEXT NOT NULL,
        current_level TEXT NOT NULL,
        weekly_hours TEXT NOT NULL,
        overall_band REAL NOT NULL,
        speaking_band REAL NOT NULL,
        writing_band REAL NOT NULL,
        reading_band REAL NOT NULL,
        listening_band REAL NOT NULL,
        priority_skill TEXT NOT NULL,
        strength_skill TEXT NOT NULL,
        reading_correct INTEGER NOT NULL,
        listening_correct INTEGER NOT NULL,
        writing_words INTEGER NOT NULL,
        speaking_confidence INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`),
      getD1().prepare(
        "CREATE INDEX IF NOT EXISTS assessment_results_user_email_created_at_idx ON assessment_results (user_email, created_at)",
      ),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS study_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        task_date TEXT NOT NULL,
        skill TEXT NOT NULL,
        title TEXT NOT NULL,
        minutes INTEGER NOT NULL,
        task_type TEXT NOT NULL,
        completed_at TEXT,
        created_at TEXT NOT NULL
      )`),
      getD1().prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS study_tasks_user_date_title_uidx ON study_tasks (user_email, task_date, title)",
      ),
      getD1().prepare(
        "CREATE INDEX IF NOT EXISTS study_tasks_user_date_idx ON study_tasks (user_email, task_date)",
      ),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS mock_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        user_name TEXT NOT NULL,
        week_start TEXT NOT NULL,
        overall_band REAL NOT NULL,
        speaking_band REAL NOT NULL,
        writing_band REAL NOT NULL,
        reading_band REAL NOT NULL,
        listening_band REAL NOT NULL,
        priority_skill TEXT NOT NULL,
        strength_skill TEXT NOT NULL,
        reading_correct INTEGER NOT NULL,
        listening_correct INTEGER NOT NULL,
        writing_words INTEGER NOT NULL,
        speaking_confidence INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`),
      getD1().prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS mock_results_user_week_uidx ON mock_results (user_email, week_start)",
      ),
      getD1().prepare(
        "CREATE INDEX IF NOT EXISTS mock_results_user_created_at_idx ON mock_results (user_email, created_at)",
      ),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS capi_helper_gifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        donor_email TEXT NOT NULL,
        coins INTEGER NOT NULL,
        access_hours INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      getD1().prepare(
        "CREATE INDEX IF NOT EXISTS capi_helper_gifts_donor_created_at_idx ON capi_helper_gifts (donor_email, created_at)",
      ),
      getD1().prepare(
        "CREATE INDEX IF NOT EXISTS capi_helper_gifts_status_created_at_idx ON capi_helper_gifts (status, created_at)",
      ),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS lesson_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        module TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        lesson_title TEXT NOT NULL,
        status TEXT NOT NULL,
        score REAL NOT NULL,
        correct_count INTEGER NOT NULL,
        total_count INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 1,
        completed_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      getD1().prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS lesson_progress_user_module_lesson_uidx ON lesson_progress (user_email, module, lesson_id)",
      ),
      getD1().prepare(
        "CREATE INDEX IF NOT EXISTS lesson_progress_user_updated_at_idx ON lesson_progress (user_email, updated_at)",
      ),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS ai_practice_assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        skill TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        overall_band REAL NOT NULL,
        criterion_one REAL NOT NULL,
        criterion_two REAL NOT NULL,
        criterion_three REAL NOT NULL,
        criterion_four REAL NOT NULL,
        summary TEXT NOT NULL,
        strengths_json TEXT NOT NULL,
        priorities_json TEXT NOT NULL,
        word_count INTEGER,
        created_at TEXT NOT NULL
      )`),
      getD1().prepare(
        "CREATE INDEX IF NOT EXISTS ai_practice_assessments_user_created_at_idx ON ai_practice_assessments (user_email, created_at)",
      ),
      getD1().prepare(
        "CREATE INDEX IF NOT EXISTS ai_practice_assessments_user_skill_created_at_idx ON ai_practice_assessments (user_email, skill, created_at)",
      ),
    ])
    .then(() => undefined);
  return schemaReady;
}

export const ensureAssessmentSchema = ensureAppSchema;

export async function getLatestAssessmentForEmail(email: string) {
  await ensureAppSchema();
  return (
    await getDb()
      .select()
      .from(schema.assessmentResults)
      .where(eq(schema.assessmentResults.userEmail, email))
      .orderBy(desc(schema.assessmentResults.createdAt))
      .limit(1)
  )[0] ?? null;
}

export async function getMockResultsForEmail(email: string, limit = 2) {
  await ensureAppSchema();
  return getDb().select().from(schema.mockResults)
    .where(eq(schema.mockResults.userEmail, email))
    .orderBy(desc(schema.mockResults.createdAt))
    .limit(limit);
}

export async function saveAiPracticeAssessment(input: {
  userEmail: string;
  skill: "Speaking" | "Writing";
  lessonId: string;
  lessonTitle: string;
  overallBand: number;
  criteria: [number, number, number, number];
  summary: string;
  strengths: string[];
  priorities: string[];
  wordCount?: number;
}) {
  await ensureAppSchema();
  const createdAt = new Date().toISOString();
  const db = getDb();
  await db.insert(schema.aiPracticeAssessments).values({
    userEmail: input.userEmail,
    skill: input.skill,
    lessonId: input.lessonId,
    overallBand: input.overallBand,
    criterionOne: input.criteria[0],
    criterionTwo: input.criteria[1],
    criterionThree: input.criteria[2],
    criterionFour: input.criteria[3],
    summary: input.summary.slice(0, 500),
    strengthsJson: JSON.stringify(input.strengths.slice(0, 3)),
    prioritiesJson: JSON.stringify(input.priorities.slice(0, 3)),
    wordCount: input.wordCount ?? null,
    createdAt,
  });
  const lessonScore = Math.round(input.overallBand / 9 * 100);
  await db.insert(schema.lessonProgress).values({
    userEmail: input.userEmail,
    module: input.skill,
    lessonId: input.lessonId,
    lessonTitle: input.lessonTitle.slice(0, 160),
    status: "completed",
    score: lessonScore,
    correctCount: lessonScore,
    totalCount: 100,
    attempts: 1,
    completedAt: createdAt,
    updatedAt: createdAt,
  }).onConflictDoUpdate({
    target: [schema.lessonProgress.userEmail, schema.lessonProgress.module, schema.lessonProgress.lessonId],
    set: {
      lessonTitle: input.lessonTitle.slice(0, 160),
      status: "completed",
      score: lessonScore,
      correctCount: lessonScore,
      totalCount: 100,
      attempts: sql`${schema.lessonProgress.attempts} + 1`,
      completedAt: createdAt,
      updatedAt: createdAt,
    },
  });
}

export async function getDashboardLearningData(email: string, priority: Skill) {
  await ensureAppSchema();
  const now = new Date();
  const today = isoDate(now);
  const createdAt = now.toISOString();
  const skills: Skill[] = ["Speaking", "Writing", "Reading", "Listening"];
  const [progressRows, assessmentRows] = await Promise.all([
    getDb().select().from(schema.lessonProgress)
      .where(eq(schema.lessonProgress.userEmail, email))
      .orderBy(desc(schema.lessonProgress.updatedAt)).limit(100),
    getDb().select().from(schema.aiPracticeAssessments)
      .where(eq(schema.aiPracticeAssessments.userEmail, email))
      .orderBy(desc(schema.aiPracticeAssessments.createdAt)).limit(20),
  ]);
  const adaptiveScores = skills.flatMap((skill) => {
    const recentExercises = progressRows.filter((row) => row.module === skill).slice(0, 5);
    const latestAi = assessmentRows.find((row) => row.skill === skill);
    if (!recentExercises.length && !latestAi) return [];
    const exerciseScore = recentExercises.length ? recentExercises.reduce((total, row) => total + row.score, 0) / recentExercises.length : null;
    const aiScore = latestAi ? latestAi.overallBand / 9 * 100 : null;
    const score = aiScore !== null && exerciseScore !== null ? aiScore * .7 + exerciseScore * .3 : aiScore ?? exerciseScore ?? 100;
    return [{ skill, score }];
  });
  const adaptivePriority = adaptiveScores.sort((a, b) => a.score - b.score)[0]?.skill ?? priority;
  await getDb().insert(schema.studyTasks).values(
    createDailyPlan(adaptivePriority, now).map((task) => ({
      userEmail: email,
      taskDate: today,
      skill: task.skill,
      title: task.title,
      minutes: task.minutes,
      taskType: task.taskType,
      completedAt: null,
      createdAt,
    })),
  ).onConflictDoNothing();

  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);
  const [tasks, completed, recent, mocks, earned, gifts] = await Promise.all([
    getDb().select().from(schema.studyTasks)
      .where(and(eq(schema.studyTasks.userEmail, email), eq(schema.studyTasks.taskDate, today)))
      .orderBy(schema.studyTasks.id),
    getDb().select({ taskDate: schema.studyTasks.taskDate }).from(schema.studyTasks)
      .where(and(
        eq(schema.studyTasks.userEmail, email),
        isNotNull(schema.studyTasks.completedAt),
        gte(schema.studyTasks.taskDate, isoDate(sixtyDaysAgo)),
      )),
    getDb().select().from(schema.studyTasks)
      .where(and(eq(schema.studyTasks.userEmail, email), isNotNull(schema.studyTasks.completedAt)))
      .orderBy(desc(schema.studyTasks.completedAt)).limit(6),
    getMockResultsForEmail(email, 2),
    getDb().select({ id: schema.studyTasks.id }).from(schema.studyTasks)
      .where(and(eq(schema.studyTasks.userEmail, email), isNotNull(schema.studyTasks.completedAt))),
    getDb().select({ coins: schema.capiHelperGifts.coins }).from(schema.capiHelperGifts)
      .where(eq(schema.capiHelperGifts.donorEmail, email)),
  ]);

  const completedDates = new Set(completed.map((row) => row.taskDate));
  const thisWeekDates = new Set(completed.filter((row) => row.taskDate >= weekStart(now) && row.taskDate <= weekEnd(now)).map((row) => row.taskDate));
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00.000Z`);
  if (!completedDates.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (completedDates.has(isoDate(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const earnedPoints = earned.length * 40;
  const giftedPoints = gifts.reduce((total, gift) => total + gift.coins, 0);
  const lessonTotals: Record<Skill, number> = { Speaking: 3, Writing: 12, Reading: 14, Listening: 12 };
  const moduleProgress = skills.map((skill) => {
    const rows = progressRows.filter((row) => row.module === skill);
    return {
      skill,
      completed: rows.length,
      total: lessonTotals[skill],
      averageScore: rows.length ? Math.round(rows.reduce((total, row) => total + row.score, 0) / rows.length) : null,
    };
  });
  const currentWeekStart = `${weekStart(now)}T00:00:00.000Z`;
  const weeklyLessonRows = progressRows.filter((row) => row.updatedAt >= currentWeekStart);
  const weeklyExerciseAverage = weeklyLessonRows.length ? Math.round(weeklyLessonRows.reduce((total, row) => total + row.score, 0) / weeklyLessonRows.length) : null;
  const latestAi = assessmentRows[0] ?? null;
  const previousSameSkill = latestAi ? assessmentRows.find((row) => row.skill === latestAi.skill && row.id !== latestAi.id) ?? null : null;
  const aiChange = latestAi && previousSameSkill ? Number((latestAi.overallBand - previousSameSkill.overallBand).toFixed(1)) : null;
  const mockChange = mocks[0] && mocks[1] ? Number((mocks[0].overallBand - mocks[1].overallBand).toFixed(1)) : null;
  return {
    tasks,
    recent,
    mocks,
    adaptivePriority,
    moduleProgress,
    assessmentHistory: assessmentRows.slice(0, 8).map((row) => ({
      id: row.id,
      skill: row.skill as "Speaking" | "Writing",
      lessonId: row.lessonId,
      overallBand: row.overallBand,
      summary: row.summary,
      createdAt: row.createdAt,
    })),
    weeklyReport: {
      weekStart: weekStart(now),
      lessonsCompleted: weeklyLessonRows.length,
      exerciseAverage: weeklyExerciseAverage,
      latestAiSkill: latestAi?.skill as "Speaking" | "Writing" | undefined,
      latestAiBand: latestAi?.overallBand ?? null,
      aiChange,
      latestMockBand: mocks[0]?.overallBand ?? null,
      mockChange,
      focusSkill: adaptivePriority,
    },
    stats: {
      points: Math.max(0, earnedPoints - giftedPoints),
      earnedPoints,
      sponsoredPasses: gifts.length,
      streak,
      completedDaysThisWeek: thisWeekDates.size,
      completedTasksToday: tasks.filter((task) => task.completedAt).length,
      totalMinutesToday: tasks.reduce((total, task) => total + task.minutes, 0),
    },
  };
}
