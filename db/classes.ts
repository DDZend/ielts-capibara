import { ensureAppSchema, getD1 } from ".";
import { classAllowanceForPlan, utcWeekWindow, type ClassAllowance } from "../lib/class-allowances";

export type ClassSessionView = {
  id: number; title: string; sessionType: "group" | "individual"; cohortId: number | null; cohortName: string | null;
  studentEmail: string | null; teacherEmail: string; teacherName: string; startsAt: string; endsAt: string; timezone: string;
  meetingProvider: string; meetingUrl: string; capacity: number; bookedCount: number; status: string;
  cancellationReason: string | null;
};

export type TeacherClassSnapshot = {
  students: Array<{ email: string; targetBand: number; currentBand: number | null; lessonsCompleted: number; exerciseAverage: number; planInterval: string; membershipStatus: string; expiresAt: string | null; teacherEmail: string | null; cohortNames: string[] }>;
  teachers: Array<{ email: string; displayName: string; timezone: string; color: string; active: boolean }>;
  cohorts: Array<{ id: number; name: string; targetBand: number; teacherEmail: string | null; startDate: string | null; endDate: string | null; status: string; memberCount: number }>;
  sessions: ClassSessionView[];
  rosters: Array<{ sessionId: number; studentEmail: string; bookingStatus: string; attendanceStatus: string | null; attendanceNote: string | null }>;
  availability: Array<{ id: number; teacherEmail: string; dayOfWeek: number; startTime: string; endTime: string; timezone: string }>;
  homework: Array<{ id: number; title: string; module: string; lessonId: string | null; exerciseId: string | null; targetType: string; targetValue: string; dueAt: string; status: string; assignedBy: string; submissionCount: number; completedCount: number }>;
  notes: Array<{ id: number; studentEmail: string; teacherEmail: string; body: string; visibleToStudent: boolean; createdAt: string }>;
  workload: Array<{ teacherEmail: string; teacherName: string; classCount: number; minutes: number; studentCount: number }>;
};

export type StudentClassSnapshot = {
  allowance: ClassAllowance & { planInterval: string | null; bookedThisWeek: number; remainingThisWeek: number; expiresAt: string | null };
  assignedTeacher: { email: string; displayName: string } | null;
  upcoming: ClassSessionView[];
  available: ClassSessionView[];
  reminders: Array<{ sessionId: number; title: string; startsAt: string; message: string }>;
  homework: Array<{ id: number; title: string; instructions: string; module: string; lessonId: string | null; exerciseId: string | null; dueAt: string; status: string; studentNote: string | null; teacherComment: string | null }>;
  comments: Array<{ id: number; teacherName: string; body: string; createdAt: string }>;
};

type MembershipRow = { plan_interval: string; expires_at: string | null };

export async function getStudentMeetingMembership(email: string) {
  await ensureAppSchema();
  const now = new Date().toISOString();
  const paid = await getD1().prepare(`SELECT plan_interval, current_period_end AS expires_at FROM subscriptions WHERE user_email = ? AND (
    (status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > ?)) OR (status = 'past_due' AND grace_until > ?)
  ) LIMIT 1`).bind(email, now, now).first<MembershipRow>();
  const manual = paid ? null : await getD1().prepare(`SELECT plan_interval, expires_at FROM manual_access_grants
    WHERE user_email = ? AND status = 'active' AND starts_at <= ? AND expires_at > ? ORDER BY expires_at DESC LIMIT 1`)
    .bind(email, now, now).first<MembershipRow>();
  const membership = paid ?? manual ?? null;
  return { planInterval: membership?.plan_interval ?? null, expiresAt: membership?.expires_at ?? null, allowance: classAllowanceForPlan(membership?.plan_interval ?? null) };
}

export async function ensureTeacherProfile(email: string, displayName: string) {
  await ensureAppSchema();
  const now = new Date().toISOString();
  await getD1().prepare(`INSERT INTO teacher_profiles (email, display_name, timezone, color, active, created_at, updated_at)
    VALUES (?, ?, 'Asia/Almaty', '#16803e', 1, ?, ?) ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, active = 1, updated_at = excluded.updated_at`)
    .bind(email.toLowerCase(), displayName, now, now).run();
}

const sessionQuery = `SELECT cs.id, cs.title, cs.session_type, cs.cohort_id, c.name AS cohort_name, cs.student_email,
  cs.teacher_email, COALESCE(tp.display_name, cs.teacher_email) AS teacher_name, cs.starts_at, cs.ends_at, cs.timezone,
  cs.meeting_provider, cs.meeting_url, cs.capacity, cs.status, cs.cancellation_reason,
  (SELECT COUNT(*) FROM class_bookings b WHERE b.session_id = cs.id AND b.status = 'booked') AS booked_count
  FROM class_sessions cs LEFT JOIN cohorts c ON c.id = cs.cohort_id LEFT JOIN teacher_profiles tp ON tp.email = cs.teacher_email`;

function mapSessions(rows: Record<string, unknown>[]): ClassSessionView[] {
  return rows.map((row) => ({
    id: Number(row.id), title: String(row.title), sessionType: row.session_type as "group" | "individual",
    cohortId: row.cohort_id == null ? null : Number(row.cohort_id), cohortName: row.cohort_name == null ? null : String(row.cohort_name),
    studentEmail: row.student_email == null ? null : String(row.student_email), teacherEmail: String(row.teacher_email), teacherName: String(row.teacher_name),
    startsAt: String(row.starts_at), endsAt: String(row.ends_at), timezone: String(row.timezone), meetingProvider: String(row.meeting_provider),
    meetingUrl: String(row.meeting_url), capacity: Number(row.capacity), bookedCount: Number(row.booked_count), status: String(row.status),
    cancellationReason: row.cancellation_reason == null ? null : String(row.cancellation_reason),
  }));
}

export async function getTeacherClassSnapshot(currentTeacherEmail: string, displayName: string): Promise<TeacherClassSnapshot> {
  await ensureTeacherProfile(currentTeacherEmail, displayName);
  const now = new Date().toISOString();
  const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const [students, teachers, cohorts, sessions, rosters, availability, homework, notes, workload] = await Promise.all([
    getD1().prepare(`WITH student_emails AS (
      SELECT user_email AS email FROM assessment_results UNION SELECT user_email FROM study_tasks
      UNION SELECT user_email FROM lesson_progress UNION SELECT user_email FROM ai_practice_assessments
      UNION SELECT user_email FROM subscriptions UNION SELECT user_email FROM manual_access_grants
      UNION SELECT student_email FROM cohort_members UNION SELECT student_email FROM student_teacher_assignments
      UNION SELECT recipient_email FROM sponsored_access_passes WHERE recipient_email IS NOT NULL
    ) SELECT e.email,
      COALESCE((SELECT target_band FROM assessment_results a WHERE a.user_email = e.email ORDER BY a.created_at DESC LIMIT 1), 7.0) AS target_band,
      (SELECT overall_band FROM assessment_results a WHERE a.user_email = e.email ORDER BY a.created_at DESC LIMIT 1) AS current_band,
      COALESCE((SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_email = e.email AND lp.status = 'completed'), 0) AS lessons_completed,
      COALESCE((SELECT AVG(score) FROM lesson_progress lp WHERE lp.user_email = e.email), 0) AS exercise_average,
      CASE WHEN s.status IN ('active', 'trialing', 'past_due') THEN s.plan_interval
        ELSE COALESCE((SELECT plan_interval FROM manual_access_grants m WHERE m.user_email = e.email AND m.status = 'active' AND m.expires_at > ? ORDER BY m.expires_at DESC LIMIT 1), s.plan_interval, 'none') END AS plan_interval,
      CASE WHEN s.status IN ('active', 'trialing', 'past_due') THEN s.status
        WHEN EXISTS (SELECT 1 FROM manual_access_grants m WHERE m.user_email = e.email AND m.status = 'active' AND m.expires_at > ?) THEN 'manual'
        ELSE COALESCE(s.status, 'none') END AS membership_status,
      CASE WHEN s.status IN ('active', 'trialing', 'past_due') THEN s.current_period_end
        ELSE COALESCE((SELECT expires_at FROM manual_access_grants m WHERE m.user_email = e.email AND m.status = 'active' AND m.expires_at > ? ORDER BY m.expires_at DESC LIMIT 1), s.current_period_end) END AS expires_at,
      sta.teacher_email,
      COALESCE((SELECT GROUP_CONCAT(c.name, '||') FROM cohort_members cm JOIN cohorts c ON c.id = cm.cohort_id WHERE cm.student_email = e.email AND cm.status = 'active' AND c.status = 'active'), '') AS cohort_names
      FROM student_emails e LEFT JOIN subscriptions s ON s.user_email = e.email LEFT JOIN student_teacher_assignments sta ON sta.student_email = e.email AND sta.status = 'active'
      ORDER BY e.email`).bind(now, now, now).all<Record<string, unknown>>(),
    getD1().prepare("SELECT email, display_name, timezone, color, active FROM teacher_profiles ORDER BY active DESC, display_name").all<Record<string, unknown>>(),
    getD1().prepare(`SELECT c.id, c.name, c.target_band, c.teacher_email, c.start_date, c.end_date, c.status,
      (SELECT COUNT(*) FROM cohort_members cm WHERE cm.cohort_id = c.id AND cm.status = 'active') AS member_count FROM cohorts c ORDER BY c.status, c.start_date DESC, c.name`).all<Record<string, unknown>>(),
    getD1().prepare(`${sessionQuery} ORDER BY cs.starts_at DESC LIMIT 150`).all<Record<string, unknown>>(),
    getD1().prepare(`SELECT b.session_id, b.student_email, b.status AS booking_status, a.status AS attendance_status, a.note AS attendance_note
      FROM class_bookings b LEFT JOIN attendance_records a ON a.session_id = b.session_id AND a.student_email = b.student_email ORDER BY b.updated_at DESC LIMIT 500`).all<Record<string, unknown>>(),
    getD1().prepare("SELECT id, teacher_email, day_of_week, start_time, end_time, timezone FROM teacher_availability WHERE active = 1 ORDER BY teacher_email, day_of_week, start_time").all<Record<string, unknown>>(),
    getD1().prepare(`SELECT h.id, h.title, h.module, h.lesson_id, h.exercise_id, h.assigned_to_type, h.assigned_to_value, h.due_at, h.status, h.assigned_by,
      (SELECT COUNT(*) FROM homework_submissions s WHERE s.assignment_id = h.id) AS submission_count,
      (SELECT COUNT(*) FROM homework_submissions s WHERE s.assignment_id = h.id AND s.status = 'completed') AS completed_count
      FROM homework_assignments h ORDER BY h.due_at DESC LIMIT 100`).all<Record<string, unknown>>(),
    getD1().prepare("SELECT id, student_email, teacher_email, body, visible_to_student, created_at FROM student_notes ORDER BY created_at DESC LIMIT 200").all<Record<string, unknown>>(),
    getD1().prepare(`SELECT tp.email AS teacher_email, tp.display_name AS teacher_name,
      COALESCE((SELECT COUNT(*) FROM class_sessions cs WHERE cs.teacher_email = tp.email AND cs.status = 'scheduled' AND cs.starts_at >= ? AND cs.starts_at < ?), 0) AS class_count,
      COALESCE((SELECT SUM((julianday(cs.ends_at) - julianday(cs.starts_at)) * 1440) FROM class_sessions cs WHERE cs.teacher_email = tp.email AND cs.status = 'scheduled' AND cs.starts_at >= ? AND cs.starts_at < ?), 0) AS minutes,
      COALESCE((SELECT COUNT(DISTINCT student_email) FROM student_teacher_assignments sta WHERE sta.teacher_email = tp.email AND sta.status = 'active'), 0) AS student_count
      FROM teacher_profiles tp WHERE tp.active = 1 ORDER BY class_count DESC, tp.display_name`).bind(now, inSevenDays, now, inSevenDays).all<Record<string, unknown>>(),
  ]);

  return {
    students: (students.results ?? []).map((r) => ({ email: String(r.email), targetBand: Number(r.target_band), currentBand: r.current_band == null ? null : Number(r.current_band), lessonsCompleted: Number(r.lessons_completed), exerciseAverage: Number(r.exercise_average), planInterval: String(r.plan_interval), membershipStatus: String(r.membership_status), expiresAt: r.expires_at == null ? null : String(r.expires_at), teacherEmail: r.teacher_email == null ? null : String(r.teacher_email), cohortNames: String(r.cohort_names || "").split("||").filter(Boolean) })),
    teachers: (teachers.results ?? []).map((r) => ({ email: String(r.email), displayName: String(r.display_name), timezone: String(r.timezone), color: String(r.color), active: Boolean(r.active) })),
    cohorts: (cohorts.results ?? []).map((r) => ({ id: Number(r.id), name: String(r.name), targetBand: Number(r.target_band), teacherEmail: r.teacher_email == null ? null : String(r.teacher_email), startDate: r.start_date == null ? null : String(r.start_date), endDate: r.end_date == null ? null : String(r.end_date), status: String(r.status), memberCount: Number(r.member_count) })),
    sessions: mapSessions(sessions.results ?? []),
    rosters: (rosters.results ?? []).map((r) => ({ sessionId: Number(r.session_id), studentEmail: String(r.student_email), bookingStatus: String(r.booking_status), attendanceStatus: r.attendance_status == null ? null : String(r.attendance_status), attendanceNote: r.attendance_note == null ? null : String(r.attendance_note) })),
    availability: (availability.results ?? []).map((r) => ({ id: Number(r.id), teacherEmail: String(r.teacher_email), dayOfWeek: Number(r.day_of_week), startTime: String(r.start_time), endTime: String(r.end_time), timezone: String(r.timezone) })),
    homework: (homework.results ?? []).map((r) => ({ id: Number(r.id), title: String(r.title), module: String(r.module), lessonId: r.lesson_id == null ? null : String(r.lesson_id), exerciseId: r.exercise_id == null ? null : String(r.exercise_id), targetType: String(r.assigned_to_type), targetValue: String(r.assigned_to_value), dueAt: String(r.due_at), status: String(r.status), assignedBy: String(r.assigned_by), submissionCount: Number(r.submission_count), completedCount: Number(r.completed_count) })),
    notes: (notes.results ?? []).map((r) => ({ id: Number(r.id), studentEmail: String(r.student_email), teacherEmail: String(r.teacher_email), body: String(r.body), visibleToStudent: Boolean(r.visible_to_student), createdAt: String(r.created_at) })),
    workload: (workload.results ?? []).map((r) => ({ teacherEmail: String(r.teacher_email), teacherName: String(r.teacher_name), classCount: Number(r.class_count), minutes: Math.round(Number(r.minutes)), studentCount: Number(r.student_count) })),
  };
}

async function bookedThisWeek(email: string, excludeSessionId?: number) {
  const window = utcWeekWindow();
  const row = await getD1().prepare(`SELECT COUNT(*) AS count FROM class_bookings b JOIN class_sessions s ON s.id = b.session_id
    WHERE b.student_email = ? AND b.status = 'booked' AND s.status = 'scheduled' AND s.starts_at >= ? AND s.starts_at < ?
      AND (? IS NULL OR s.id != ?)`)
    .bind(email, window.start, window.end, excludeSessionId ?? null, excludeSessionId ?? null).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function getStudentClassSnapshot(email: string): Promise<StudentClassSnapshot> {
  await ensureAppSchema();
  const now = new Date().toISOString();
  const reminderEnd = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const membership = await getStudentMeetingMembership(email);
  const count = await bookedThisWeek(email);
  const assignment = await getD1().prepare(`SELECT sta.teacher_email, COALESCE(tp.display_name, sta.teacher_email) AS display_name
    FROM student_teacher_assignments sta LEFT JOIN teacher_profiles tp ON tp.email = sta.teacher_email WHERE sta.student_email = ? AND sta.status = 'active' LIMIT 1`)
    .bind(email).first<{ teacher_email: string; display_name: string }>();
  const cohortRows = await getD1().prepare("SELECT cohort_id FROM cohort_members WHERE student_email = ? AND status = 'active'").bind(email).all<{ cohort_id: number }>();
  const cohortIds = new Set((cohortRows.results ?? []).map((row) => row.cohort_id));
  const [upcomingRows, availableRows, homeworkRows, commentsRows] = await Promise.all([
    getD1().prepare(`${sessionQuery} JOIN class_bookings own_booking ON own_booking.session_id = cs.id AND own_booking.student_email = ? AND own_booking.status = 'booked'
      WHERE cs.status = 'scheduled' AND cs.starts_at > ? ORDER BY cs.starts_at LIMIT 30`).bind(email, now).all<Record<string, unknown>>(),
    getD1().prepare(`${sessionQuery} WHERE cs.status = 'scheduled' AND cs.starts_at > ?
      AND NOT EXISTS (SELECT 1 FROM class_bookings own WHERE own.session_id = cs.id AND own.student_email = ? AND own.status = 'booked')
      ORDER BY cs.starts_at LIMIT 100`).bind(now, email).all<Record<string, unknown>>(),
    getD1().prepare(`SELECT h.id, h.title, h.instructions, h.module, h.lesson_id, h.exercise_id, h.due_at,
      COALESCE(s.status, 'assigned') AS submission_status, s.student_note, s.teacher_comment
      FROM homework_assignments h LEFT JOIN homework_submissions s ON s.assignment_id = h.id AND s.student_email = ?
      WHERE h.status = 'active' AND (
        (h.assigned_to_type = 'student' AND h.assigned_to_value = ?)
        OR (h.assigned_to_type = 'cohort' AND CAST(h.assigned_to_value AS INTEGER) IN (SELECT cohort_id FROM cohort_members WHERE student_email = ? AND status = 'active'))
        OR (h.assigned_to_type = 'session' AND CAST(h.assigned_to_value AS INTEGER) IN (SELECT session_id FROM class_bookings WHERE student_email = ? AND status = 'booked'))
      ) ORDER BY h.due_at`).bind(email, email, email, email).all<Record<string, unknown>>(),
    getD1().prepare(`SELECT n.id, COALESCE(tp.display_name, n.teacher_email) AS teacher_name, n.body, n.created_at FROM student_notes n
      LEFT JOIN teacher_profiles tp ON tp.email = n.teacher_email WHERE n.student_email = ? AND n.visible_to_student = 1 ORDER BY n.created_at DESC LIMIT 30`).bind(email).all<Record<string, unknown>>(),
  ]);
  const upcoming = mapSessions(upcomingRows.results ?? []);
  const available = mapSessions(availableRows.results ?? []).filter((session) => {
    if (session.sessionType !== membership.allowance.sessionType) return false;
    if (session.sessionType === "group") return session.cohortId != null && cohortIds.has(session.cohortId) && session.bookedCount < session.capacity;
    return (!session.studentEmail || session.studentEmail === email) && (!assignment || session.teacherEmail === assignment.teacher_email) && session.bookedCount < session.capacity;
  }).map((session) => ({ ...session, meetingUrl: "" }));
  return {
    allowance: { ...membership.allowance, planInterval: membership.planInterval, bookedThisWeek: count, remainingThisWeek: Math.max(0, membership.allowance.weeklyLimit - count), expiresAt: membership.expiresAt },
    assignedTeacher: assignment ? { email: assignment.teacher_email, displayName: assignment.display_name } : null,
    upcoming,
    available,
    reminders: upcoming.filter((session) => session.startsAt <= reminderEnd).map((session) => ({ sessionId: session.id, title: session.title, startsAt: session.startsAt, message: `Your ${session.sessionType} lesson with ${session.teacherName} is coming up.` })),
    homework: (homeworkRows.results ?? []).map((r) => ({ id: Number(r.id), title: String(r.title), instructions: String(r.instructions), module: String(r.module), lessonId: r.lesson_id == null ? null : String(r.lesson_id), exerciseId: r.exercise_id == null ? null : String(r.exercise_id), dueAt: String(r.due_at), status: String(r.submission_status), studentNote: r.student_note == null ? null : String(r.student_note), teacherComment: r.teacher_comment == null ? null : String(r.teacher_comment) })),
    comments: (commentsRows.results ?? []).map((r) => ({ id: Number(r.id), teacherName: String(r.teacher_name), body: String(r.body), createdAt: String(r.created_at) })),
  };
}

export async function validateStudentBooking(email: string, sessionId: number, excludeSessionId?: number) {
  const membership = await getStudentMeetingMembership(email);
  if (!membership.allowance.weeklyLimit) return { error: membership.allowance.tier === "silver" ? "Silver is platform-only and does not include teacher meetings." : "Your current access does not include teacher meetings." } as const;
  const session = await getD1().prepare(`SELECT id, session_type, cohort_id, student_email, teacher_email, starts_at, capacity, status,
    (SELECT COUNT(*) FROM class_bookings b WHERE b.session_id = class_sessions.id AND b.status = 'booked') AS booked_count
    FROM class_sessions WHERE id = ? LIMIT 1`).bind(sessionId).first<{ id: number; session_type: string; cohort_id: number | null; student_email: string | null; teacher_email: string; starts_at: string; capacity: number; status: string; booked_count: number }>();
  if (!session || session.status !== "scheduled" || session.starts_at <= new Date().toISOString()) return { error: "That class is no longer available." } as const;
  if (session.session_type !== membership.allowance.sessionType) return { error: `${membership.allowance.tier === "gold" ? "Gold includes group meetings" : "Platinum includes individual meetings"}. Choose the matching class type.` } as const;
  if (session.booked_count >= session.capacity) return { error: "That class is already full." } as const;
  if (session.session_type === "group") {
    const member = await getD1().prepare("SELECT 1 AS allowed FROM cohort_members WHERE cohort_id = ? AND student_email = ? AND status = 'active' LIMIT 1").bind(session.cohort_id, email).first();
    if (!member) return { error: "This class belongs to another cohort." } as const;
  } else {
    if (session.student_email && session.student_email !== email) return { error: "This individual slot is reserved for another student." } as const;
    const assigned = await getD1().prepare("SELECT teacher_email FROM student_teacher_assignments WHERE student_email = ? AND status = 'active' LIMIT 1").bind(email).first<{ teacher_email: string }>();
    if (assigned && assigned.teacher_email !== session.teacher_email) return { error: "Choose an individual slot with your assigned teacher." } as const;
  }
  const count = await bookedThisWeek(email, excludeSessionId);
  if (count >= membership.allowance.weeklyLimit) return { error: `Your ${membership.allowance.tier} package allows ${membership.allowance.weeklyLimit} teacher meetings per week.` } as const;
  return { session, membership } as const;
}
