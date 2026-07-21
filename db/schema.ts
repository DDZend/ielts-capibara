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

export const capiTutorMessages = sqliteTable(
  "capi_tutor_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }), userEmail: text("user_email").notNull(),
    role: text("role").notNull(), content: text("content").notNull(), language: text("language").notNull().default("en"),
    intent: text("intent").notNull().default("general"), citationsJson: text("citations_json").notNull().default("[]"),
    practiceJson: text("practice_json"), confidence: real("confidence"),
    escalationRequired: integer("escalation_required", { mode: "boolean" }).notNull().default(false), createdAt: text("created_at").notNull(),
  },
  (table) => [index("capi_tutor_messages_user_created_idx").on(table.userEmail, table.createdAt)],
);

export const capiTutorUsage = sqliteTable(
  "capi_tutor_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }), userEmail: text("user_email").notNull(),
    usageDate: text("usage_date").notNull(), messageCount: integer("message_count").notNull().default(0), updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("capi_tutor_usage_user_date_uidx").on(table.userEmail, table.usageDate)],
);

export const capiTutorEscalations = sqliteTable(
  "capi_tutor_escalations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }), userEmail: text("user_email").notNull(),
    messageId: integer("message_id").notNull(), question: text("question").notNull(), reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"), teacherReply: text("teacher_reply"), resolvedBy: text("resolved_by"),
    createdAt: text("created_at").notNull(), resolvedAt: text("resolved_at"),
  },
  (table) => [
    index("capi_tutor_escalations_status_created_idx").on(table.status, table.createdAt),
    index("capi_tutor_escalations_user_created_idx").on(table.userEmail, table.createdAt),
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
    promotionCode: text("promotion_code"),
    currentPeriodStart: text("current_period_start"),
    currentPeriodEnd: text("current_period_end"),
    graceUntil: text("grace_until"),
    lastPaymentError: text("last_payment_error"),
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
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeChargeId: text("stripe_charge_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    amountPaid: integer("amount_paid").notNull(),
    refundedAmount: integer("refunded_amount").notNull().default(0),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    planInterval: text("plan_interval").notNull(),
    discountPercent: integer("discount_percent").notNull().default(0),
    promotionCode: text("promotion_code"),
    receiptUrl: text("receipt_url"),
    invoicePdfUrl: text("invoice_pdf_url"),
    failureReason: text("failure_reason"),
    paidAt: text("paid_at").notNull(),
    updatedAt: text("updated_at").notNull(),
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

export const manualAccessGrants = sqliteTable(
  "manual_access_grants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    planInterval: text("plan_interval").notNull(),
    status: text("status").notNull(),
    startsAt: text("starts_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    note: text("note"),
    grantedBy: text("granted_by").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("manual_access_grants_user_expires_at_idx").on(table.userEmail, table.expiresAt),
  ],
);

export const promotionCodes = sqliteTable(
  "promotion_codes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    percentOff: integer("percent_off").notNull(),
    maxRedemptions: integer("max_redemptions"),
    redemptionCount: integer("redemption_count").notNull().default(0),
    reservedCount: integer("reserved_count").notNull().default(0),
    expiresAt: text("expires_at"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("promotion_codes_code_uidx").on(table.code)],
);

export const promotionRedemptions = sqliteTable(
  "promotion_redemptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    promotionCodeId: integer("promotion_code_id").notNull(),
    userEmail: text("user_email").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    redeemedAt: text("redeemed_at"),
  },
  (table) => [
    uniqueIndex("promotion_redemptions_session_uidx").on(table.stripeCheckoutSessionId),
    uniqueIndex("promotion_redemptions_code_user_uidx").on(table.promotionCodeId, table.userEmail),
  ],
);

export const billingNotifications = sqliteTable(
  "billing_notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    stripeEventId: text("stripe_event_id"),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    actionUrl: text("action_url"),
    status: text("status").notNull().default("unread"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("billing_notifications_event_uidx").on(table.stripeEventId),
    index("billing_notifications_user_created_at_idx").on(table.userEmail, table.createdAt),
  ],
);

export const staffRoles = sqliteTable(
  "staff_roles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull().default("teacher"),
    status: text("status").notNull().default("invited"),
    permissionsJson: text("permissions_json").notNull().default("[]"),
    invitedBy: text("invited_by").notNull(),
    invitedAt: text("invited_at").notNull(),
    activatedAt: text("activated_at"),
    lastSignedInAt: text("last_signed_in_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("staff_roles_email_uidx").on(table.email),
    index("staff_roles_status_role_idx").on(table.status, table.role),
  ],
);

export const teacherAccessRequests = sqliteTable(
  "teacher_access_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    message: text("message").notNull().default(""),
    status: text("status").notNull().default("pending"),
    requestedAt: text("requested_at").notNull(),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
  },
  (table) => [
    uniqueIndex("teacher_access_requests_email_uidx").on(table.email),
    index("teacher_access_requests_status_requested_idx").on(table.status, table.requestedAt),
  ],
);

export const teacherProfiles = sqliteTable(
  "teacher_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    timezone: text("timezone").notNull().default("Asia/Almaty"),
    color: text("color").notNull().default("#16803e"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("teacher_profiles_email_uidx").on(table.email)],
);

export const cohorts = sqliteTable(
  "cohorts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    targetBand: real("target_band").notNull(),
    teacherEmail: text("teacher_email"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("cohorts_teacher_status_idx").on(table.teacherEmail, table.status)],
);

export const cohortMembers = sqliteTable(
  "cohort_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cohortId: integer("cohort_id").notNull(),
    studentEmail: text("student_email").notNull(),
    status: text("status").notNull().default("active"),
    joinedAt: text("joined_at").notNull(),
  },
  (table) => [
    uniqueIndex("cohort_members_cohort_student_uidx").on(table.cohortId, table.studentEmail),
    index("cohort_members_student_status_idx").on(table.studentEmail, table.status),
  ],
);

export const studentTeacherAssignments = sqliteTable(
  "student_teacher_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentEmail: text("student_email").notNull(),
    teacherEmail: text("teacher_email").notNull(),
    status: text("status").notNull().default("active"),
    assignedBy: text("assigned_by").notNull(),
    assignedAt: text("assigned_at").notNull(),
  },
  (table) => [
    uniqueIndex("student_teacher_assignments_student_uidx").on(table.studentEmail),
    index("student_teacher_assignments_teacher_status_idx").on(table.teacherEmail, table.status),
  ],
);

export const teacherAvailability = sqliteTable(
  "teacher_availability",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    teacherEmail: text("teacher_email").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    timezone: text("timezone").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("teacher_availability_teacher_day_idx").on(table.teacherEmail, table.dayOfWeek)],
);

export const classSessions = sqliteTable(
  "class_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    sessionType: text("session_type").notNull(),
    cohortId: integer("cohort_id"),
    studentEmail: text("student_email"),
    teacherEmail: text("teacher_email").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    timezone: text("timezone").notNull(),
    meetingProvider: text("meeting_provider").notNull(),
    meetingUrl: text("meeting_url").notNull(),
    capacity: integer("capacity").notNull().default(1),
    status: text("status").notNull().default("scheduled"),
    cancellationReason: text("cancellation_reason"),
    cancelledBy: text("cancelled_by"),
    cancelledAt: text("cancelled_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("class_sessions_teacher_starts_idx").on(table.teacherEmail, table.startsAt),
    index("class_sessions_cohort_starts_idx").on(table.cohortId, table.startsAt),
    index("class_sessions_student_starts_idx").on(table.studentEmail, table.startsAt),
  ],
);

export const classBookings = sqliteTable(
  "class_bookings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id").notNull(),
    studentEmail: text("student_email").notNull(),
    status: text("status").notNull().default("booked"),
    bookedAt: text("booked_at").notNull(),
    cancelledAt: text("cancelled_at"),
    cancellationReason: text("cancellation_reason"),
    rescheduledFromSessionId: integer("rescheduled_from_session_id"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("class_bookings_session_student_uidx").on(table.sessionId, table.studentEmail),
    index("class_bookings_student_status_idx").on(table.studentEmail, table.status),
  ],
);

export const attendanceRecords = sqliteTable(
  "attendance_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id").notNull(),
    studentEmail: text("student_email").notNull(),
    status: text("status").notNull(),
    note: text("note"),
    markedBy: text("marked_by").notNull(),
    markedAt: text("marked_at").notNull(),
  },
  (table) => [uniqueIndex("attendance_records_session_student_uidx").on(table.sessionId, table.studentEmail)],
);

export const homeworkAssignments = sqliteTable(
  "homework_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    instructions: text("instructions").notNull(),
    module: text("module").notNull(),
    lessonId: text("lesson_id"),
    exerciseId: text("exercise_id"),
    assignedToType: text("assigned_to_type").notNull(),
    assignedToValue: text("assigned_to_value").notNull(),
    dueAt: text("due_at").notNull(),
    status: text("status").notNull().default("active"),
    assignedBy: text("assigned_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("homework_assignments_target_due_idx").on(table.assignedToType, table.assignedToValue, table.dueAt)],
);

export const homeworkSubmissions = sqliteTable(
  "homework_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    assignmentId: integer("assignment_id").notNull(),
    studentEmail: text("student_email").notNull(),
    status: text("status").notNull().default("assigned"),
    studentNote: text("student_note"),
    teacherComment: text("teacher_comment"),
    submittedAt: text("submitted_at"),
    reviewedAt: text("reviewed_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("homework_submissions_assignment_student_uidx").on(table.assignmentId, table.studentEmail),
    index("homework_submissions_student_status_idx").on(table.studentEmail, table.status),
  ],
);

export const studentNotes = sqliteTable(
  "student_notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentEmail: text("student_email").notNull(),
    teacherEmail: text("teacher_email").notNull(),
    body: text("body").notNull(),
    visibleToStudent: integer("visible_to_student", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("student_notes_student_created_idx").on(table.studentEmail, table.createdAt)],
);

export const mockTests = sqliteTable(
  "mock_tests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("draft"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("mock_tests_status_updated_idx").on(table.status, table.updatedAt)],
);

export const mockTestVersions = sqliteTable(
  "mock_test_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    testId: integer("test_id").notNull(),
    label: text("label").notNull(),
    status: text("status").notNull().default("draft"),
    readingMinutes: integer("reading_minutes").notNull().default(60),
    listeningMinutes: integer("listening_minutes").notNull().default(40),
    writingMinutes: integer("writing_minutes").notNull().default(60),
    speakingMinutes: integer("speaking_minutes").notNull().default(15),
    itemsJson: text("items_json").notNull().default("[]"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    publishedAt: text("published_at"),
  },
  (table) => [
    uniqueIndex("mock_test_versions_test_label_uidx").on(table.testId, table.label),
    index("mock_test_versions_status_published_idx").on(table.status, table.publishedAt),
  ],
);

export const mockAttempts = sqliteTable(
  "mock_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    testId: integer("test_id").notNull(),
    versionId: integer("version_id").notNull(),
    userEmail: text("user_email").notNull(),
    userName: text("user_name").notNull(),
    status: text("status").notNull().default("in_progress"),
    examMode: integer("exam_mode", { mode: "boolean" }).notNull().default(true),
    currentItemIndex: integer("current_item_index").notNull().default(0),
    currentSection: text("current_section").notNull().default("Reading"),
    sectionStartedAt: text("section_started_at").notNull(),
    answersJson: text("answers_json").notNull().default("{}"),
    readingCorrect: integer("reading_correct"),
    readingTotal: integer("reading_total"),
    listeningCorrect: integer("listening_correct"),
    listeningTotal: integer("listening_total"),
    readingBand: real("reading_band"),
    listeningBand: real("listening_band"),
    writingAiBand: real("writing_ai_band"),
    speakingAiBand: real("speaking_ai_band"),
    writingTeacherBand: real("writing_teacher_band"),
    speakingTeacherBand: real("speaking_teacher_band"),
    overallBand: real("overall_band"),
    teacherComment: text("teacher_comment").notNull().default(""),
    startedAt: text("started_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    submittedAt: text("submitted_at"),
  },
  (table) => [
    index("mock_attempts_user_status_updated_idx").on(table.userEmail, table.status, table.updatedAt),
    index("mock_attempts_user_submitted_idx").on(table.userEmail, table.submittedAt),
    index("mock_attempts_version_status_idx").on(table.versionId, table.status),
  ],
);

export const mockItemResults = sqliteTable(
  "mock_item_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    attemptId: integer("attempt_id").notNull(),
    itemKey: text("item_key").notNull(),
    skill: text("skill").notNull(),
    questionType: text("question_type").notNull(),
    correct: integer("correct", { mode: "boolean" }),
    rawScore: real("raw_score").notNull().default(0),
    maxScore: real("max_score").notNull().default(1),
    aiBand: real("ai_band"),
    teacherBand: real("teacher_band"),
    feedbackJson: text("feedback_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("mock_item_results_attempt_item_uidx").on(table.attemptId, table.itemKey),
    index("mock_item_results_type_correct_idx").on(table.questionType, table.correct),
  ],
);

export const mockRecordings = sqliteTable(
  "mock_recordings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    attemptId: integer("attempt_id").notNull(),
    itemKey: text("item_key").notNull(),
    userEmail: text("user_email").notNull(),
    r2Key: text("r2_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    transcript: text("transcript").notNull().default(""),
    aiFeedbackJson: text("ai_feedback_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("mock_recordings_attempt_item_uidx").on(table.attemptId, table.itemKey),
    uniqueIndex("mock_recordings_r2_key_uidx").on(table.r2Key),
  ],
);

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerEmail: text("owner_email").notNull(),
    r2Key: text("r2_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    kind: text("kind").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("media_assets_r2_key_uidx").on(table.r2Key),
    index("media_assets_owner_created_at_idx").on(table.ownerEmail, table.createdAt),
  ],
);

export const creatorLessons = sqliteTable(
  "creator_lessons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    module: text("module").notNull(),
    lessonId: text("lesson_id").notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    status: text("status").notNull().default("published"),
    videoMediaId: integer("video_media_id"),
    audioMediaId: integer("audio_media_id"),
    vocabularyJson: text("vocabulary_json").notNull().default("[]"),
    exercisesJson: text("exercises_json").notNull().default("[]"),
    transcript: text("transcript").notNull().default(""),
    answerKeyJson: text("answer_key_json").notNull().default("[]"),
    updatedBy: text("updated_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("creator_lessons_module_lesson_uidx").on(table.module, table.lessonId),
    index("creator_lessons_module_position_idx").on(table.module, table.position),
  ],
);

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type CreatorLesson = typeof creatorLessons.$inferSelect;
