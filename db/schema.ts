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
