import { getCreatorLessons } from "./creator";
import { ensureAppSchema, getD1 } from "./index";
import {
  lessonHref,
  tutorLimitForPlan,
  type TutorCitation,
  type TutorLanguage,
  type TutorMessageView,
  type TutorPractice,
  type TutorRole,
  type TutorUsage,
} from "../lib/capi-tutor";
import type { CourseModule } from "../lib/course-catalog";

type MessageRow = {
  id: number; role: TutorRole; content: string; language: TutorLanguage; intent: string;
  citations_json: string; practice_json: string | null; confidence: number | null;
  escalation_required: number; created_at: string;
};

type AccessPlan = { planId: string; planLabel: string; limit: number };

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function mapMessage(row: MessageRow): TutorMessageView {
  return {
    id: row.id, role: row.role, content: row.content, language: row.language, intent: row.intent,
    citations: parseJson<TutorCitation[]>(row.citations_json, []),
    practice: parseJson<TutorPractice | null>(row.practice_json, null), confidence: row.confidence,
    escalationRequired: Boolean(row.escalation_required), createdAt: row.created_at,
  };
}

function usageDate(date = new Date()) { return date.toISOString().slice(0, 10); }
function resetTime(date = new Date()) { const next = new Date(date); next.setUTCHours(24, 0, 0, 0); return next.toISOString(); }

export async function getTutorAccessPlan(email: string): Promise<AccessPlan> {
  await ensureAppSchema();
  const now = new Date().toISOString();
  const subscription = await getD1().prepare(`SELECT plan_interval FROM subscriptions WHERE user_email = ? AND (
    (status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > ?))
    OR (status = 'past_due' AND grace_until > ?)
  ) LIMIT 1`).bind(email, now, now).first<{ plan_interval: string }>();
  const manual = subscription ? null : await getD1().prepare(`SELECT plan_interval FROM manual_access_grants
    WHERE user_email = ? AND status = 'active' AND starts_at <= ? AND expires_at > ? ORDER BY expires_at DESC LIMIT 1`)
    .bind(email, now, now).first<{ plan_interval: string }>();
  const starter = subscription || manual ? null : await getD1().prepare(`SELECT 1 AS found FROM paid_access_passes
    WHERE user_email = ? AND status = 'active' AND expires_at > ? LIMIT 1`).bind(email, now).first<{ found: number }>();
  const sponsored = subscription || manual || starter ? null : await getD1().prepare(`SELECT 1 AS found FROM sponsored_access_passes
    WHERE recipient_email = ? AND status = 'claimed' AND expires_at > ? LIMIT 1`).bind(email, now).first<{ found: number }>();
  const planId = subscription?.plan_interval ?? manual?.plan_interval ?? (starter ? "starter_week" : sponsored ? "sponsored" : "platform");
  const plan = tutorLimitForPlan(planId);
  return { planId, planLabel: plan.label, limit: plan.limit };
}

export async function getTutorUsage(email: string): Promise<TutorUsage> {
  await ensureAppSchema();
  const plan = await getTutorAccessPlan(email);
  const row = await getD1().prepare("SELECT message_count FROM capi_tutor_usage WHERE user_email = ? AND usage_date = ? LIMIT 1")
    .bind(email, usageDate()).first<{ message_count: number }>();
  const used = Number(row?.message_count ?? 0);
  return { ...plan, used, remaining: Math.max(0, plan.limit - used), resetsAt: resetTime() };
}

export async function reserveTutorMessage(email: string) {
  await ensureAppSchema();
  const usage = await getTutorUsage(email);
  if (usage.remaining <= 0) return { allowed: false as const, usage };
  const now = new Date().toISOString();
  await getD1().prepare(`INSERT OR IGNORE INTO capi_tutor_usage (user_email, usage_date, message_count, updated_at) VALUES (?, ?, 0, ?)`)
    .bind(email, usageDate(), now).run();
  const result = await getD1().prepare(`UPDATE capi_tutor_usage SET message_count = message_count + 1, updated_at = ?
    WHERE user_email = ? AND usage_date = ? AND message_count < ?`).bind(now, email, usageDate(), usage.limit).run();
  if (Number(result.meta.changes ?? 0) === 0) return { allowed: false as const, usage: await getTutorUsage(email) };
  return { allowed: true as const, usage: await getTutorUsage(email) };
}

export async function releaseTutorMessage(email: string) {
  await ensureAppSchema();
  await getD1().prepare(`UPDATE capi_tutor_usage SET message_count = MAX(0, message_count - 1), updated_at = ?
    WHERE user_email = ? AND usage_date = ?`).bind(new Date().toISOString(), email, usageDate()).run();
}

export async function getTutorMessages(email: string, limit = 30) {
  await ensureAppSchema();
  const result = await getD1().prepare(`SELECT id, role, content, language, intent, citations_json, practice_json,
    confidence, escalation_required, created_at FROM capi_tutor_messages WHERE user_email = ? ORDER BY id DESC LIMIT ?`)
    .bind(email, Math.max(1, Math.min(50, limit))).all<MessageRow>();
  return (result.results ?? []).reverse().map(mapMessage);
}

async function insertTutorMessage(input: {
  email: string; role: TutorRole; content: string; language: TutorLanguage; intent?: string;
  citations?: TutorCitation[]; practice?: TutorPractice | null; confidence?: number | null; escalationRequired?: boolean;
}) {
  const createdAt = new Date().toISOString();
  const result = await getD1().prepare(`INSERT INTO capi_tutor_messages
    (user_email, role, content, language, intent, citations_json, practice_json, confidence, escalation_required, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(input.email, input.role, input.content, input.language, input.intent ?? "general", JSON.stringify(input.citations ?? []),
      input.practice ? JSON.stringify(input.practice) : null, input.confidence ?? null, input.escalationRequired ? 1 : 0, createdAt).run();
  return mapMessage({
    id: Number(result.meta.last_row_id), role: input.role, content: input.content, language: input.language,
    intent: input.intent ?? "general", citations_json: JSON.stringify(input.citations ?? []),
    practice_json: input.practice ? JSON.stringify(input.practice) : null, confidence: input.confidence ?? null,
    escalation_required: input.escalationRequired ? 1 : 0, created_at: createdAt,
  });
}

export async function saveTutorExchange(input: {
  email: string; question: string; language: TutorLanguage; answer: string; intent: string;
  citations: TutorCitation[]; practice: TutorPractice | null; confidence: number; escalationRequired: boolean; escalationReason: string;
}) {
  await ensureAppSchema();
  const studentMessage = await insertTutorMessage({ email: input.email, role: "student", content: input.question, language: input.language, intent: input.intent });
  const assistantMessage = await insertTutorMessage({
    email: input.email, role: "capi", content: input.answer, language: input.language, intent: input.intent,
    citations: input.citations, practice: input.practice, confidence: input.confidence, escalationRequired: input.escalationRequired,
  });
  if (input.escalationRequired) {
    await getD1().prepare(`INSERT INTO capi_tutor_escalations
      (user_email, message_id, question, reason, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`)
      .bind(input.email, assistantMessage.id, input.question, input.escalationReason || "Capy requested teacher confirmation.", new Date().toISOString()).run();
  }
  return { studentMessage, assistantMessage };
}

const moduleTerms: Record<CourseModule, string[]> = {
  Speaking: ["speaking", "speak", "pronunciation", "fluency", "говор", "устн", "сөйле", "айтылым"],
  Writing: ["writing", "essay", "sentence", "grammar", "write", "пись", "эссе", "жаз", "сөйлем"],
  Reading: ["reading", "read", "heading", "paragraph", "чтен", "текст", "оқу", "мәтін"],
  Listening: ["listening", "listen", "audio", "hearing", "аудир", "слуш", "тыңда", "аудио"],
};

function inferredModule(question: string): CourseModule | null {
  const lower = question.toLowerCase();
  return (Object.entries(moduleTerms) as Array<[CourseModule, string[]]>).find(([, terms]) => terms.some((term) => lower.includes(term)))?.[0] ?? null;
}

export async function getTutorContext(email: string, question: string) {
  await ensureAppSchema();
  const today = usageDate();
  const [assessment, progress, aiAssessments, mocks, mistakes, tasks, activeExam, history, teacher, lessons] = await Promise.all([
    getD1().prepare("SELECT * FROM assessment_results WHERE user_email = ? ORDER BY created_at DESC LIMIT 1").bind(email).first<Record<string, unknown>>(),
    getD1().prepare("SELECT module, lesson_id, lesson_title, score, attempts, updated_at FROM lesson_progress WHERE user_email = ? ORDER BY updated_at DESC LIMIT 30").bind(email).all<Record<string, unknown>>(),
    getD1().prepare("SELECT skill, lesson_id, overall_band, summary, priorities_json, created_at FROM ai_practice_assessments WHERE user_email = ? ORDER BY created_at DESC LIMIT 8").bind(email).all<Record<string, unknown>>(),
    getD1().prepare("SELECT overall_band, speaking_band, writing_band, reading_band, listening_band, priority_skill, created_at FROM mock_results WHERE user_email = ? ORDER BY created_at DESC LIMIT 3").bind(email).all<Record<string, unknown>>(),
    getD1().prepare(`SELECT mir.skill, mir.question_type, mir.feedback_json, mir.updated_at FROM mock_item_results mir
      JOIN mock_attempts ma ON ma.id = mir.attempt_id WHERE ma.user_email = ? AND ma.status = 'submitted' AND mir.correct = 0
      ORDER BY mir.updated_at DESC LIMIT 8`).bind(email).all<Record<string, unknown>>(),
    getD1().prepare("SELECT skill, title, minutes, completed_at FROM study_tasks WHERE user_email = ? AND task_date = ? ORDER BY id").bind(email, today).all<Record<string, unknown>>(),
    getD1().prepare("SELECT id, current_section FROM mock_attempts WHERE user_email = ? AND status = 'in_progress' AND exam_mode = 1 ORDER BY updated_at DESC LIMIT 1").bind(email).first<{ id: number; current_section: string }>(),
    getTutorMessages(email, 10),
    getD1().prepare(`SELECT tp.display_name FROM student_teacher_assignments sta JOIN teacher_profiles tp ON tp.email = sta.teacher_email
      WHERE sta.student_email = ? AND sta.status = 'active' LIMIT 1`).bind(email).first<{ display_name: string }>(),
    getCreatorLessons(),
  ]);

  const preferredModule = inferredModule(question) ?? String(assessment?.priority_skill ?? "Reading") as CourseModule;
  const terms = question.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((term) => term.length >= 3);
  const selectedLessons = lessons.filter((lesson) => lesson.status === "published").map((lesson) => {
    const haystack = `${lesson.module} ${lesson.lessonId} ${lesson.title} ${lesson.vocabulary.join(" ")} ${lesson.transcript.slice(0, 4000)}`.toLowerCase();
    const score = (lesson.module === preferredModule ? 8 : 0) + terms.reduce((total, term) => total + (haystack.includes(term) ? 2 : 0), 0);
    return { lesson, score };
  }).sort((a, b) => b.score - a.score || a.lesson.position - b.lesson.position).slice(0, 4).map(({ lesson }) => ({
    ref: `${lesson.module}:${lesson.lessonId}`, module: lesson.module, lessonId: lesson.lessonId, title: lesson.title,
    href: lessonHref(lesson.module, lesson.lessonId), transcript: lesson.transcript.slice(0, 3000), vocabulary: lesson.vocabulary.slice(0, 30),
    exercises: lesson.exercises.slice(0, 6).map((exercise) => ({ type: exercise.type, title: exercise.title, instruction: exercise.instruction, prompt: exercise.prompt, options: exercise.options })),
  }));

  return {
    activeExam: activeExam ? { id: activeExam.id, section: activeExam.current_section } : null,
    student: {
      assessment: assessment ? {
        targetBand: assessment.target_band, currentLevel: assessment.current_level, overallBand: assessment.overall_band,
        speakingBand: assessment.speaking_band, writingBand: assessment.writing_band, readingBand: assessment.reading_band,
        listeningBand: assessment.listening_band, prioritySkill: assessment.priority_skill, strengthSkill: assessment.strength_skill,
        examTiming: assessment.exam_timing, weeklyHours: assessment.weekly_hours,
      } : null, progress: progress.results ?? [], aiAssessments: aiAssessments.results ?? [],
      mockHistory: mocks.results ?? [], recentMistakes: mistakes.results ?? [], todayPlan: tasks.results ?? [],
      assignedTeacher: teacher?.display_name ?? null,
    },
    lessons: selectedLessons,
    history,
  };
}

export type TutorEscalationView = {
  id: number; userEmail: string; question: string; reason: string; status: string;
  teacherReply: string | null; resolvedBy: string | null; createdAt: string; resolvedAt: string | null;
};

export async function getTutorEscalations() {
  await ensureAppSchema();
  const result = await getD1().prepare(`SELECT id, user_email, question, reason, status, teacher_reply, resolved_by, created_at, resolved_at
    FROM capi_tutor_escalations ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100`).all<Record<string, unknown>>();
  return (result.results ?? []).map((row): TutorEscalationView => ({
    id: Number(row.id), userEmail: String(row.user_email), question: String(row.question), reason: String(row.reason),
    status: String(row.status), teacherReply: row.teacher_reply == null ? null : String(row.teacher_reply),
    resolvedBy: row.resolved_by == null ? null : String(row.resolved_by), createdAt: String(row.created_at),
    resolvedAt: row.resolved_at == null ? null : String(row.resolved_at),
  }));
}

export async function resolveTutorEscalation(input: { id: number; reply: string; teacherEmail: string }) {
  await ensureAppSchema();
  const row = await getD1().prepare(`SELECT e.user_email, COALESCE(m.language, 'en') AS language FROM capi_tutor_escalations e
    LEFT JOIN capi_tutor_messages m ON m.id = e.message_id WHERE e.id = ? AND e.status = 'pending' LIMIT 1`)
    .bind(input.id).first<{ user_email: string; language: TutorLanguage }>();
  if (!row) throw new Error("This support request is no longer waiting.");
  const now = new Date().toISOString();
  await getD1().prepare(`UPDATE capi_tutor_escalations SET status = 'resolved', teacher_reply = ?, resolved_by = ?, resolved_at = ? WHERE id = ?`)
    .bind(input.reply, input.teacherEmail, now, input.id).run();
  await insertTutorMessage({ email: row.user_email, role: "teacher", content: input.reply, language: row.language, intent: "teacher_follow_up" });
  return getTutorEscalations();
}
