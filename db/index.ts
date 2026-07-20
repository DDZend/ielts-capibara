import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import * as schema from "./schema";
import type { Skill } from "../lib/assessment";
import { discountForCoins } from "../lib/billing-config";
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
      getD1().prepare(`CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        plan_interval TEXT NOT NULL,
        status TEXT NOT NULL,
        discount_percent INTEGER NOT NULL DEFAULT 0,
        promotion_code TEXT,
        current_period_start TEXT,
        current_period_end TEXT,
        grace_until TEXT,
        last_payment_error TEXT,
        cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      getD1().prepare("CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_email_uidx ON subscriptions (user_email)"),
      getD1().prepare("CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_uidx ON subscriptions (stripe_subscription_id)"),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS payment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        stripe_event_id TEXT NOT NULL,
        stripe_invoice_id TEXT,
        stripe_payment_intent_id TEXT,
        stripe_charge_id TEXT,
        stripe_checkout_session_id TEXT,
        amount_paid INTEGER NOT NULL,
        refunded_amount INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL,
        status TEXT NOT NULL,
        plan_interval TEXT NOT NULL,
        discount_percent INTEGER NOT NULL DEFAULT 0,
        promotion_code TEXT,
        receipt_url TEXT,
        invoice_pdf_url TEXT,
        failure_reason TEXT,
        paid_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      getD1().prepare("CREATE UNIQUE INDEX IF NOT EXISTS payment_history_stripe_event_uidx ON payment_history (stripe_event_id)"),
      getD1().prepare("CREATE INDEX IF NOT EXISTS payment_history_user_paid_at_idx ON payment_history (user_email, paid_at)"),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS sponsored_access_passes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        donor_email TEXT NOT NULL,
        pass_code TEXT NOT NULL,
        coins INTEGER NOT NULL,
        access_hours INTEGER NOT NULL,
        recipient_email TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        claimed_at TEXT,
        expires_at TEXT
      )`),
      getD1().prepare("CREATE UNIQUE INDEX IF NOT EXISTS sponsored_access_passes_code_uidx ON sponsored_access_passes (pass_code)"),
      getD1().prepare("CREATE INDEX IF NOT EXISTS sponsored_access_passes_donor_created_at_idx ON sponsored_access_passes (donor_email, created_at)"),
      getD1().prepare("CREATE INDEX IF NOT EXISTS sponsored_access_passes_recipient_expires_at_idx ON sponsored_access_passes (recipient_email, expires_at)"),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS paid_access_passes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        stripe_checkout_session_id TEXT NOT NULL,
        status TEXT NOT NULL,
        amount_paid INTEGER NOT NULL,
        currency TEXT NOT NULL,
        starts_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        credit_amount INTEGER NOT NULL,
        credit_reserved_session_id TEXT,
        credit_used_at TEXT,
        created_at TEXT NOT NULL
      )`),
      getD1().prepare("CREATE UNIQUE INDEX IF NOT EXISTS paid_access_passes_checkout_session_uidx ON paid_access_passes (stripe_checkout_session_id)"),
      getD1().prepare("CREATE INDEX IF NOT EXISTS paid_access_passes_user_expires_at_idx ON paid_access_passes (user_email, expires_at)"),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS manual_access_grants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        plan_interval TEXT NOT NULL,
        status TEXT NOT NULL,
        starts_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        note TEXT,
        granted_by TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT NOT NULL
      )`),
      getD1().prepare("CREATE INDEX IF NOT EXISTS manual_access_grants_user_expires_at_idx ON manual_access_grants (user_email, expires_at)"),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS promotion_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        percent_off INTEGER NOT NULL,
        max_redemptions INTEGER,
        redemption_count INTEGER NOT NULL DEFAULT 0,
        reserved_count INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      getD1().prepare("CREATE UNIQUE INDEX IF NOT EXISTS promotion_codes_code_uidx ON promotion_codes (code)"),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS promotion_redemptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        promotion_code_id INTEGER NOT NULL,
        user_email TEXT NOT NULL,
        stripe_checkout_session_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        redeemed_at TEXT
      )`),
      getD1().prepare("CREATE UNIQUE INDEX IF NOT EXISTS promotion_redemptions_session_uidx ON promotion_redemptions (stripe_checkout_session_id)"),
      getD1().prepare("CREATE UNIQUE INDEX IF NOT EXISTS promotion_redemptions_code_user_uidx ON promotion_redemptions (promotion_code_id, user_email)"),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS billing_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        stripe_event_id TEXT,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        action_url TEXT,
        status TEXT NOT NULL DEFAULT 'unread',
        created_at TEXT NOT NULL
      )`),
      getD1().prepare("CREATE UNIQUE INDEX IF NOT EXISTS billing_notifications_event_uidx ON billing_notifications (stripe_event_id)"),
      getD1().prepare("CREATE INDEX IF NOT EXISTS billing_notifications_user_created_at_idx ON billing_notifications (user_email, created_at)"),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS media_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_email TEXT NOT NULL,
        r2_key TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        kind TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      getD1().prepare("CREATE UNIQUE INDEX IF NOT EXISTS media_assets_r2_key_uidx ON media_assets (r2_key)"),
      getD1().prepare("CREATE INDEX IF NOT EXISTS media_assets_owner_created_at_idx ON media_assets (owner_email, created_at)"),
      getD1().prepare(`CREATE TABLE IF NOT EXISTS creator_lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        title TEXT NOT NULL,
        position INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'published',
        video_media_id INTEGER,
        audio_media_id INTEGER,
        vocabulary_json TEXT NOT NULL DEFAULT '[]',
        exercises_json TEXT NOT NULL DEFAULT '[]',
        transcript TEXT NOT NULL DEFAULT '',
        answer_key_json TEXT NOT NULL DEFAULT '[]',
        updated_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      getD1().prepare("CREATE UNIQUE INDEX IF NOT EXISTS creator_lessons_module_lesson_uidx ON creator_lessons (module, lesson_id)"),
      getD1().prepare("CREATE INDEX IF NOT EXISTS creator_lessons_module_position_idx ON creator_lessons (module, position)"),
    ])
    .then(async () => {
      const additions: Record<string, Array<[string, string]>> = {
        subscriptions: [
          ["promotion_code", "TEXT"], ["current_period_start", "TEXT"], ["grace_until", "TEXT"], ["last_payment_error", "TEXT"],
        ],
        payment_history: [
          ["stripe_payment_intent_id", "TEXT"], ["stripe_charge_id", "TEXT"], ["stripe_checkout_session_id", "TEXT"],
          ["refunded_amount", "INTEGER NOT NULL DEFAULT 0"], ["promotion_code", "TEXT"], ["receipt_url", "TEXT"],
          ["invoice_pdf_url", "TEXT"], ["failure_reason", "TEXT"], ["updated_at", "TEXT NOT NULL DEFAULT ''"],
        ],
      };
      for (const [table, columns] of Object.entries(additions)) {
        const info = await getD1().prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
        const existing = new Set((info.results ?? []).map((column) => column.name));
        for (const [name, definition] of columns) {
          if (!existing.has(name)) await getD1().prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
        }
      }
    })
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
  const [tasks, completed, recent, mocks, earned, gifts, sponsored] = await Promise.all([
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
    getDb().select({ coins: schema.sponsoredAccessPasses.coins }).from(schema.sponsoredAccessPasses)
      .where(eq(schema.sponsoredAccessPasses.donorEmail, email)),
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
  const giftedPoints = [...gifts, ...sponsored].reduce((total, gift) => total + gift.coins, 0);
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
      sponsoredPasses: gifts.length + sponsored.length,
      streak,
      completedDaysThisWeek: thisWeekDates.size,
      completedTasksToday: tasks.filter((task) => task.completedAt).length,
      totalMinutesToday: tasks.reduce((total, task) => total + task.minutes, 0),
    },
  };
}

export type BillingSummary = {
  earnedCoins: number;
  availableCoins: number;
  discountPercent: number;
  subscription: {
    planInterval: string;
    status: string;
    discountPercent: number;
    promotionCode: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    graceUntil: string | null;
    lastPaymentError: string | null;
    cancelAtPeriodEnd: boolean;
    hasCustomer: boolean;
  } | null;
  manualGrant: { id: number; planInterval: string; expiresAt: string; note: string | null } | null;
  activePass: { expiresAt: string; accessHours: number } | null;
  starterPass: { expiresAt: string; accessDays: number } | null;
  starterCredit: { passId: number; amount: number } | null;
  hasStarterPurchase: boolean;
  sponsoredPasses: Array<{
    id: number;
    passCode: string;
    coins: number;
    accessHours: number;
    recipientEmail: string | null;
    status: string;
    createdAt: string;
    claimedAt: string | null;
    expiresAt: string | null;
  }>;
  payments: Array<{
    id: number;
    amountPaid: number;
    currency: string;
    status: string;
    planInterval: string;
    discountPercent: number;
    promotionCode: string | null;
    refundedAmount: number;
    receiptUrl: string | null;
    invoicePdfUrl: string | null;
    failureReason: string | null;
    paidAt: string;
  }>;
  notifications: Array<{ id: number; kind: string; title: string; message: string; actionUrl: string | null; createdAt: string }>;
};

type SubscriptionRow = {
  plan_interval: string;
  status: string;
  discount_percent: number;
  promotion_code: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_until: string | null;
  last_payment_error: string | null;
  cancel_at_period_end: number;
  stripe_customer_id: string | null;
};

type SponsoredPassRow = {
  id: number;
  pass_code: string;
  coins: number;
  access_hours: number;
  recipient_email: string | null;
  status: string;
  created_at: string;
  claimed_at: string | null;
  expires_at: string | null;
};

type PaymentRow = {
  id: number;
  amount_paid: number;
  currency: string;
  status: string;
  plan_interval: string;
  discount_percent: number;
  promotion_code: string | null;
  refunded_amount: number;
  receipt_url: string | null;
  invoice_pdf_url: string | null;
  failure_reason: string | null;
  paid_at: string;
};

export async function getBillingSummary(email: string): Promise<BillingSummary> {
  await ensureAppSchema();
  const now = new Date().toISOString();
  await getD1().prepare(`
    UPDATE sponsored_access_passes
    SET status = 'expired'
    WHERE recipient_email = ? AND status = 'claimed' AND expires_at IS NOT NULL AND expires_at <= ?
  `).bind(email, now).run();

  const [subscription, manualGrant, activePass, starterPass, starterCredit, starterPurchase, sponsoredResult, paymentsResult, notificationsResult, coinResult] = await Promise.all([
    getD1().prepare(`SELECT plan_interval, status, discount_percent, promotion_code, current_period_start, current_period_end, grace_until, last_payment_error, cancel_at_period_end, stripe_customer_id FROM subscriptions WHERE user_email = ? LIMIT 1`).bind(email).first<SubscriptionRow>(),
    getD1().prepare(`SELECT id, plan_interval, expires_at, note FROM manual_access_grants WHERE user_email = ? AND status = 'active' AND starts_at <= ? AND expires_at > ? ORDER BY expires_at DESC LIMIT 1`).bind(email, now, now).first<{ id: number; plan_interval: string; expires_at: string; note: string | null }>(),
    getD1().prepare(`SELECT access_hours, expires_at FROM sponsored_access_passes WHERE recipient_email = ? AND status = 'claimed' AND expires_at > ? ORDER BY expires_at DESC LIMIT 1`).bind(email, now).first<{ access_hours: number; expires_at: string }>(),
    getD1().prepare(`SELECT expires_at FROM paid_access_passes WHERE user_email = ? AND status = 'active' AND expires_at > ? ORDER BY expires_at DESC LIMIT 1`).bind(email, now).first<{ expires_at: string }>(),
    getD1().prepare(`SELECT id, credit_amount FROM paid_access_passes WHERE user_email = ? AND credit_used_at IS NULL AND credit_reserved_session_id IS NULL ORDER BY created_at DESC LIMIT 1`).bind(email).first<{ id: number; credit_amount: number }>(),
    getD1().prepare(`SELECT 1 AS purchased FROM paid_access_passes WHERE user_email = ? LIMIT 1`).bind(email).first<{ purchased: number }>(),
    getD1().prepare(`SELECT id, pass_code, coins, access_hours, recipient_email, status, created_at, claimed_at, expires_at FROM sponsored_access_passes WHERE donor_email = ? ORDER BY created_at DESC LIMIT 25`).bind(email).all<SponsoredPassRow>(),
    getD1().prepare(`SELECT id, amount_paid, currency, status, plan_interval, discount_percent, promotion_code, refunded_amount, receipt_url, invoice_pdf_url, failure_reason, paid_at FROM payment_history WHERE user_email = ? ORDER BY paid_at DESC LIMIT 50`).bind(email).all<PaymentRow>(),
    getD1().prepare(`SELECT id, kind, title, message, action_url, created_at FROM billing_notifications WHERE user_email = ? AND status = 'unread' ORDER BY created_at DESC LIMIT 8`).bind(email).all<{ id: number; kind: string; title: string; message: string; action_url: string | null; created_at: string }>(),
    getD1().prepare(`SELECT
      (SELECT COUNT(*) * 40 FROM study_tasks WHERE user_email = ? AND completed_at IS NOT NULL) AS earned,
      COALESCE((SELECT SUM(coins) FROM capi_helper_gifts WHERE donor_email = ?), 0)
        + COALESCE((SELECT SUM(coins) FROM sponsored_access_passes WHERE donor_email = ?), 0) AS gifted
    `).bind(email, email, email).first<{ earned: number; gifted: number }>(),
  ]);

  const earnedCoins = Number(coinResult?.earned ?? 0);
  const giftedCoins = Number(coinResult?.gifted ?? 0);
  return {
    earnedCoins,
    availableCoins: Math.max(0, earnedCoins - giftedCoins),
    discountPercent: discountForCoins(earnedCoins),
    subscription: subscription ? {
      planInterval: subscription.plan_interval,
      status: subscription.status,
      discountPercent: subscription.discount_percent,
      promotionCode: subscription.promotion_code,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      graceUntil: subscription.grace_until,
      lastPaymentError: subscription.last_payment_error,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      hasCustomer: Boolean(subscription.stripe_customer_id),
    } : null,
    manualGrant: manualGrant ? { id: manualGrant.id, planInterval: manualGrant.plan_interval, expiresAt: manualGrant.expires_at, note: manualGrant.note } : null,
    activePass: activePass ? { expiresAt: activePass.expires_at, accessHours: activePass.access_hours } : null,
    starterPass: starterPass ? { expiresAt: starterPass.expires_at, accessDays: 7 } : null,
    starterCredit: starterCredit ? { passId: starterCredit.id, amount: starterCredit.credit_amount } : null,
    hasStarterPurchase: Boolean(starterPurchase?.purchased),
    sponsoredPasses: (sponsoredResult.results ?? []).map((pass) => ({
      id: pass.id,
      passCode: pass.pass_code,
      coins: pass.coins,
      accessHours: pass.access_hours,
      recipientEmail: pass.recipient_email,
      status: pass.status,
      createdAt: pass.created_at,
      claimedAt: pass.claimed_at,
      expiresAt: pass.expires_at,
    })),
    payments: (paymentsResult.results ?? []).map((payment) => ({
      id: payment.id,
      amountPaid: payment.amount_paid,
      currency: payment.currency,
      status: payment.status,
      planInterval: payment.plan_interval,
      discountPercent: payment.discount_percent,
      promotionCode: payment.promotion_code,
      refundedAmount: payment.refunded_amount,
      receiptUrl: payment.receipt_url,
      invoicePdfUrl: payment.invoice_pdf_url,
      failureReason: payment.failure_reason,
      paidAt: payment.paid_at,
    })),
    notifications: (notificationsResult.results ?? []).map((notification) => ({
      id: notification.id,
      kind: notification.kind,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.action_url,
      createdAt: notification.created_at,
    })),
  };
}

export async function hasLearningAccess(email: string) {
  await ensureAppSchema();
  const now = new Date().toISOString();
  const result = await getD1().prepare(`SELECT 1 AS allowed WHERE EXISTS (
    SELECT 1 FROM subscriptions WHERE user_email = ? AND (
      (status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > ?))
      OR (status = 'past_due' AND grace_until > ?)
    )
  ) OR EXISTS (
    SELECT 1 FROM manual_access_grants WHERE user_email = ? AND status = 'active' AND starts_at <= ? AND expires_at > ?
  ) OR EXISTS (
    SELECT 1 FROM sponsored_access_passes WHERE recipient_email = ? AND status = 'claimed' AND expires_at > ?
  ) OR EXISTS (
    SELECT 1 FROM paid_access_passes WHERE user_email = ? AND status = 'active' AND expires_at > ?
  ) LIMIT 1`).bind(email, now, now, email, now, now, email, now, email, now).first<{ allowed: number }>();
  return Boolean(result?.allowed);
}

export async function getSponsoredPassByCode(code: string) {
  await ensureAppSchema();
  const pass = await getD1().prepare(`SELECT pass_code, access_hours, status, claimed_at, expires_at FROM sponsored_access_passes WHERE pass_code = ? LIMIT 1`)
    .bind(code).first<{ pass_code: string; access_hours: number; status: string; claimed_at: string | null; expires_at: string | null }>();
  if (!pass) return null;
  const expired = Boolean(pass.expires_at && pass.expires_at <= new Date().toISOString());
  return {
    passCode: pass.pass_code,
    accessHours: pass.access_hours,
    status: expired ? "expired" : pass.status,
    claimedAt: pass.claimed_at,
    expiresAt: pass.expires_at,
  };
}
