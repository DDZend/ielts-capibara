import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
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

export async function getDashboardLearningData(email: string, priority: Skill) {
  await ensureAppSchema();
  const now = new Date();
  const today = isoDate(now);
  const createdAt = now.toISOString();
  await getDb().insert(schema.studyTasks).values(
    createDailyPlan(priority, now).map((task) => ({
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
  const [tasks, completed, recent, mocks] = await Promise.all([
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
  return {
    tasks,
    recent,
    mocks,
    stats: {
      points: completed.length * 40,
      streak,
      completedDaysThisWeek: thisWeekDates.size,
      completedTasksToday: tasks.filter((task) => task.completedAt).length,
      totalMinutesToday: tasks.reduce((total, task) => total + task.minutes, 0),
    },
  };
}
