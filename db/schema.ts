import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const assessmentResults = sqliteTable(
  "assessment_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    userName: text("user_name").notNull(),
    targetBand: real("target_band").notNull(),
    examTiming: text("exam_timing").notNull(),
    currentLevel: text("current_level").notNull(),
    weeklyHours: text("weekly_hours").notNull(),
    overallBand: real("overall_band").notNull(),
    speakingBand: real("speaking_band").notNull(),
    writingBand: real("writing_band").notNull(),
    readingBand: real("reading_band").notNull(),
    listeningBand: real("listening_band").notNull(),
    prioritySkill: text("priority_skill").notNull(),
    strengthSkill: text("strength_skill").notNull(),
    readingCorrect: integer("reading_correct").notNull(),
    listeningCorrect: integer("listening_correct").notNull(),
    writingWords: integer("writing_words").notNull(),
    speakingConfidence: integer("speaking_confidence").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("assessment_results_user_email_created_at_idx").on(
      table.userEmail,
      table.createdAt,
    ),
  ],
);

export type AssessmentResult = typeof assessmentResults.$inferSelect;
export type NewAssessmentResult = typeof assessmentResults.$inferInsert;

export const studyTasks = sqliteTable(
  "study_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    taskDate: text("task_date").notNull(),
    skill: text("skill").notNull(),
    title: text("title").notNull(),
    minutes: integer("minutes").notNull(),
    taskType: text("task_type").notNull(),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("study_tasks_user_date_title_uidx").on(table.userEmail, table.taskDate, table.title),
    index("study_tasks_user_date_idx").on(table.userEmail, table.taskDate),
  ],
);

export const mockResults = sqliteTable(
  "mock_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    userName: text("user_name").notNull(),
    weekStart: text("week_start").notNull(),
    overallBand: real("overall_band").notNull(),
    speakingBand: real("speaking_band").notNull(),
    writingBand: real("writing_band").notNull(),
    readingBand: real("reading_band").notNull(),
    listeningBand: real("listening_band").notNull(),
    prioritySkill: text("priority_skill").notNull(),
    strengthSkill: text("strength_skill").notNull(),
    readingCorrect: integer("reading_correct").notNull(),
    listeningCorrect: integer("listening_correct").notNull(),
    writingWords: integer("writing_words").notNull(),
    speakingConfidence: integer("speaking_confidence").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("mock_results_user_week_uidx").on(table.userEmail, table.weekStart),
    index("mock_results_user_created_at_idx").on(table.userEmail, table.createdAt),
  ],
);

export type StudyTask = typeof studyTasks.$inferSelect;
export type MockResult = typeof mockResults.$inferSelect;

export const capiHelperGifts = sqliteTable(
  "capi_helper_gifts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    donorEmail: text("donor_email").notNull(),
    coins: integer("coins").notNull(),
    accessHours: integer("access_hours").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("capi_helper_gifts_donor_created_at_idx").on(table.donorEmail, table.createdAt),
    index("capi_helper_gifts_status_created_at_idx").on(table.status, table.createdAt),
  ],
);

export type CapiHelperGift = typeof capiHelperGifts.$inferSelect;

export const lessonProgress = sqliteTable(
  "lesson_progress",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    module: text("module").notNull(),
    lessonId: text("lesson_id").notNull(),
    lessonTitle: text("lesson_title").notNull(),
    status: text("status").notNull(),
    score: real("score").notNull(),
    correctCount: integer("correct_count").notNull(),
    totalCount: integer("total_count").notNull(),
    attempts: integer("attempts").notNull().default(1),
    completedAt: text("completed_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("lesson_progress_user_module_lesson_uidx").on(table.userEmail, table.module, table.lessonId),
    index("lesson_progress_user_updated_at_idx").on(table.userEmail, table.updatedAt),
  ],
);

export const aiPracticeAssessments = sqliteTable(
  "ai_practice_assessments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    skill: text("skill").notNull(),
    lessonId: text("lesson_id").notNull(),
    overallBand: real("overall_band").notNull(),
    criterionOne: real("criterion_one").notNull(),
    criterionTwo: real("criterion_two").notNull(),
    criterionThree: real("criterion_three").notNull(),
    criterionFour: real("criterion_four").notNull(),
    summary: text("summary").notNull(),
    strengthsJson: text("strengths_json").notNull(),
    prioritiesJson: text("priorities_json").notNull(),
    wordCount: integer("word_count"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("ai_practice_assessments_user_created_at_idx").on(table.userEmail, table.createdAt),
    index("ai_practice_assessments_user_skill_created_at_idx").on(table.userEmail, table.skill, table.createdAt),
  ],
);

export type LessonProgress = typeof lessonProgress.$inferSelect;
export type AiPracticeAssessment = typeof aiPracticeAssessments.$inferSelect;

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    planInterval: text("plan_interval").notNull(),
    status: text("status").notNull(),
    discountPercent: integer("discount_percent").notNull().default(0),
    currentPeriodEnd: text("current_period_end"),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("subscriptions_user_email_uidx").on(table.userEmail),
    uniqueIndex("subscriptions_stripe_subscription_uidx").on(table.stripeSubscriptionId),
  ],
);

export const paymentHistory = sqliteTable(
  "payment_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    stripeEventId: text("stripe_event_id").notNull(),
    stripeInvoiceId: text("stripe_invoice_id"),
    amountPaid: integer("amount_paid").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    planInterval: text("plan_interval").notNull(),
    discountPercent: integer("discount_percent").notNull().default(0),
    paidAt: text("paid_at").notNull(),
  },
  (table) => [
    uniqueIndex("payment_history_stripe_event_uidx").on(table.stripeEventId),
    index("payment_history_user_paid_at_idx").on(table.userEmail, table.paidAt),
  ],
);

export const sponsoredAccessPasses = sqliteTable(
  "sponsored_access_passes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    donorEmail: text("donor_email").notNull(),
    passCode: text("pass_code").notNull(),
    coins: integer("coins").notNull(),
    accessHours: integer("access_hours").notNull(),
    recipientEmail: text("recipient_email"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    claimedAt: text("claimed_at"),
    expiresAt: text("expires_at"),
  },
  (table) => [
    uniqueIndex("sponsored_access_passes_code_uidx").on(table.passCode),
    index("sponsored_access_passes_donor_created_at_idx").on(table.donorEmail, table.createdAt),
    index("sponsored_access_passes_recipient_expires_at_idx").on(table.recipientEmail, table.expiresAt),
  ],
);

export const paidAccessPasses = sqliteTable(
  "paid_access_passes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull(),
    status: text("status").notNull(),
    amountPaid: integer("amount_paid").notNull(),
    currency: text("currency").notNull(),
    startsAt: text("starts_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    creditAmount: integer("credit_amount").notNull(),
    creditReservedSessionId: text("credit_reserved_session_id"),
    creditUsedAt: text("credit_used_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("paid_access_passes_checkout_session_uidx").on(table.stripeCheckoutSessionId),
    index("paid_access_passes_user_expires_at_idx").on(table.userEmail, table.expiresAt),
  ],
);

export type Subscription = typeof subscriptions.$inferSelect;
export type PaymentHistory = typeof paymentHistory.$inferSelect;
export type SponsoredAccessPass = typeof sponsoredAccessPasses.$inferSelect;
export type PaidAccessPass = typeof paidAccessPasses.$inferSelect;
