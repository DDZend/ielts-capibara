import { NextRequest, NextResponse } from "next/server";
import { ensureAppSchema, getD1 } from "../../../../db";
import { getStudentMeetingMembership, getTeacherClassSnapshot, validateStudentBooking } from "../../../../db/classes";
import { getApiCreatorUser } from "../../../creator-auth";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const textValue = (value: unknown, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";
const numberValue = (value: unknown) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
const isoValue = (value: unknown) => { const date = new Date(String(value ?? "")); return Number.isNaN(date.getTime()) ? null : date.toISOString(); };

export async function GET() {
  const auth = await getApiCreatorUser("classes");
  if (!auth.user) return NextResponse.json({ error: auth.status === 401 ? "Authentication required" : "Teacher access required" }, { status: auth.status });
  return NextResponse.json({ snapshot: await getTeacherClassSnapshot(auth.user.email, auth.user.displayName) });
}

export async function POST(request: NextRequest) {
  const auth = await getApiCreatorUser("classes");
  if (!auth.user) return NextResponse.json({ error: auth.status === 401 ? "Authentication required" : "Teacher access required" }, { status: auth.status });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = textValue(body?.action, 40);
  const now = new Date().toISOString();
  await ensureAppSchema();

  if (action === "create_teacher") {
    const email = textValue(body?.email, 160).toLowerCase();
    const name = textValue(body?.displayName, 100);
    const timezone = textValue(body?.timezone, 80) || "Asia/Almaty";
    const color = /^#[0-9a-f]{6}$/i.test(textValue(body?.color, 7)) ? textValue(body?.color, 7) : "#16803e";
    if (!emailPattern.test(email) || !name) return NextResponse.json({ error: "Enter the teacher's name and valid email." }, { status: 400 });
    await getD1().prepare(`INSERT INTO teacher_profiles (email, display_name, timezone, color, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?) ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, timezone = excluded.timezone, color = excluded.color, active = 1, updated_at = excluded.updated_at`)
      .bind(email, name, timezone, color, now, now).run();
  } else if (action === "create_cohort") {
    const name = textValue(body?.name, 100);
    const targetBand = Math.max(4, Math.min(9, Number(body?.targetBand) || 7));
    const teacherEmail = textValue(body?.teacherEmail, 160).toLowerCase() || null;
    const startDate = textValue(body?.startDate, 10) || null;
    const endDate = textValue(body?.endDate, 10) || null;
    if (!name) return NextResponse.json({ error: "Give the cohort a clear name." }, { status: 400 });
    if (teacherEmail && !emailPattern.test(teacherEmail)) return NextResponse.json({ error: "Choose a valid teacher." }, { status: 400 });
    await getD1().prepare(`INSERT INTO cohorts (name, target_band, teacher_email, start_date, end_date, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`).bind(name, targetBand, teacherEmail, startDate, endDate, auth.user.email, now, now).run();
  } else if (action === "add_cohort_member" || action === "remove_cohort_member") {
    const cohortId = numberValue(body?.cohortId);
    const studentEmail = textValue(body?.studentEmail, 160).toLowerCase();
    if (!cohortId || !emailPattern.test(studentEmail)) return NextResponse.json({ error: "Choose a cohort and valid student email." }, { status: 400 });
    await getD1().prepare(`INSERT INTO cohort_members (cohort_id, student_email, status, joined_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(cohort_id, student_email) DO UPDATE SET status = excluded.status`)
      .bind(cohortId, studentEmail, action === "add_cohort_member" ? "active" : "removed", now).run();
  } else if (action === "assign_teacher") {
    const studentEmail = textValue(body?.studentEmail, 160).toLowerCase();
    const teacherEmail = textValue(body?.teacherEmail, 160).toLowerCase();
    if (!emailPattern.test(studentEmail)) return NextResponse.json({ error: "Choose a valid student." }, { status: 400 });
    if (!teacherEmail) {
      await getD1().prepare("UPDATE student_teacher_assignments SET status = 'inactive', assigned_by = ?, assigned_at = ? WHERE student_email = ?")
        .bind(auth.user.email, now, studentEmail).run();
      return NextResponse.json({ ok: true, snapshot: await getTeacherClassSnapshot(auth.user.email, auth.user.displayName) });
    }
    if (!emailPattern.test(teacherEmail)) return NextResponse.json({ error: "Choose a valid teacher." }, { status: 400 });
    const teacher = await getD1().prepare("SELECT 1 AS found FROM teacher_profiles WHERE email = ? AND active = 1 LIMIT 1").bind(teacherEmail).first();
    if (!teacher) return NextResponse.json({ error: "That teacher profile is not active." }, { status: 404 });
    await getD1().prepare(`INSERT INTO student_teacher_assignments (student_email, teacher_email, status, assigned_by, assigned_at)
      VALUES (?, ?, 'active', ?, ?) ON CONFLICT(student_email) DO UPDATE SET teacher_email = excluded.teacher_email, status = 'active', assigned_by = excluded.assigned_by, assigned_at = excluded.assigned_at`)
      .bind(studentEmail, teacherEmail, auth.user.email, now).run();
  } else if (action === "add_availability") {
    const teacherEmail = textValue(body?.teacherEmail, 160).toLowerCase();
    const dayOfWeek = Math.max(0, Math.min(6, numberValue(body?.dayOfWeek)));
    const startTime = textValue(body?.startTime, 5);
    const endTime = textValue(body?.endTime, 5);
    const timezone = textValue(body?.timezone, 80) || "Asia/Almaty";
    if (!emailPattern.test(teacherEmail) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) return NextResponse.json({ error: "Choose a valid teacher and availability window." }, { status: 400 });
    await getD1().prepare(`INSERT INTO teacher_availability (teacher_email, day_of_week, start_time, end_time, timezone, active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)`).bind(teacherEmail, dayOfWeek, startTime, endTime, timezone, now).run();
  } else if (action === "remove_availability") {
    await getD1().prepare("UPDATE teacher_availability SET active = 0 WHERE id = ?").bind(numberValue(body?.id)).run();
  } else if (action === "schedule_session") {
    const title = textValue(body?.title, 120);
    const sessionType = body?.sessionType === "individual" ? "individual" : "group";
    const cohortId = sessionType === "group" ? numberValue(body?.cohortId) : null;
    const studentEmail = sessionType === "individual" ? textValue(body?.studentEmail, 160).toLowerCase() : null;
    const teacherEmail = textValue(body?.teacherEmail, 160).toLowerCase();
    const startsAt = isoValue(body?.startsAt);
    const endsAt = isoValue(body?.endsAt);
    const timezone = textValue(body?.timezone, 80) || "Asia/Almaty";
    const meetingProvider = ["Zoom", "Google Meet", "Microsoft Teams", "Other"].includes(textValue(body?.meetingProvider, 40)) ? textValue(body?.meetingProvider, 40) : "Other";
    const meetingUrl = textValue(body?.meetingUrl, 500);
    const capacity = sessionType === "group" ? Math.max(2, Math.min(30, numberValue(body?.capacity) || 10)) : 1;
    if (!title || !emailPattern.test(teacherEmail) || !startsAt || !endsAt || startsAt <= now || endsAt <= startsAt) return NextResponse.json({ error: "Complete the class title, teacher and future start/end times." }, { status: 400 });
    const duration = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000;
    if (duration < 20 || duration > 180) return NextResponse.json({ error: "Classes must be between 20 minutes and 3 hours." }, { status: 400 });
    try { const url = new URL(meetingUrl); if (url.protocol !== "https:") throw new Error(); } catch { return NextResponse.json({ error: "Use a secure Zoom, Google Meet, Teams or other HTTPS meeting link." }, { status: 400 }); }
    if (sessionType === "group" && !cohortId) return NextResponse.json({ error: "Group classes must belong to a cohort." }, { status: 400 });
    if (sessionType === "individual" && (!studentEmail || !emailPattern.test(studentEmail))) return NextResponse.json({ error: "Choose the Platinum student for this individual class." }, { status: 400 });
    if (studentEmail) {
      const membership = await getStudentMeetingMembership(studentEmail);
      if (membership.allowance.sessionType !== "individual") return NextResponse.json({ error: "Individual classes can only be scheduled for an active Platinum student." }, { status: 409 });
    }
    const conflict = await getD1().prepare(`SELECT title FROM class_sessions WHERE teacher_email = ? AND status = 'scheduled' AND starts_at < ? AND ends_at > ? LIMIT 1`)
      .bind(teacherEmail, endsAt, startsAt).first<{ title: string }>();
    if (conflict) return NextResponse.json({ error: `This teacher is already scheduled for “${conflict.title}” during that time.` }, { status: 409 });
    const inserted = await getD1().prepare(`INSERT INTO class_sessions (title, session_type, cohort_id, student_email, teacher_email, starts_at, ends_at, timezone, meeting_provider, meeting_url, capacity, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)`).bind(title, sessionType, cohortId, studentEmail, teacherEmail, startsAt, endsAt, timezone, meetingProvider, meetingUrl, capacity, auth.user.email, now, now).run();
    const sessionId = Number(inserted.meta.last_row_id);
    if (studentEmail) {
      const allowed = await validateStudentBooking(studentEmail, sessionId);
      if ("error" in allowed) {
        await getD1().prepare("DELETE FROM class_sessions WHERE id = ?").bind(sessionId).run();
        return NextResponse.json({ error: allowed.error }, { status: 409 });
      }
      await getD1().prepare(`INSERT INTO class_bookings (session_id, student_email, status, booked_at, updated_at) VALUES (?, ?, 'booked', ?, ?)`)
        .bind(sessionId, studentEmail, now, now).run();
    }
  } else if (action === "cancel_session") {
    const sessionId = numberValue(body?.sessionId);
    const reason = textValue(body?.reason, 300) || "Cancelled by teacher";
    await getD1().batch([
      getD1().prepare("UPDATE class_sessions SET status = 'cancelled', cancellation_reason = ?, cancelled_by = ?, cancelled_at = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'").bind(reason, auth.user.email, now, now, sessionId),
      getD1().prepare("UPDATE class_bookings SET status = 'cancelled', cancelled_at = ?, cancellation_reason = ?, updated_at = ? WHERE session_id = ? AND status = 'booked'").bind(now, reason, now, sessionId),
    ]);
  } else if (action === "mark_attendance") {
    const sessionId = numberValue(body?.sessionId);
    const studentEmail = textValue(body?.studentEmail, 160).toLowerCase();
    const status = ["present", "late", "absent", "excused"].includes(textValue(body?.status, 20)) ? textValue(body?.status, 20) : "present";
    const note = textValue(body?.note, 300) || null;
    if (!sessionId || !emailPattern.test(studentEmail)) return NextResponse.json({ error: "Choose a class and student." }, { status: 400 });
    await getD1().prepare(`INSERT INTO attendance_records (session_id, student_email, status, note, marked_by, marked_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, student_email) DO UPDATE SET status = excluded.status, note = excluded.note, marked_by = excluded.marked_by, marked_at = excluded.marked_at`)
      .bind(sessionId, studentEmail, status, note, auth.user.email, now).run();
  } else if (action === "assign_homework") {
    const title = textValue(body?.title, 140);
    const instructions = textValue(body?.instructions, 2000);
    const courseModule = ["Speaking", "Writing", "Reading", "Listening", "Mock test"].includes(textValue(body?.module, 30)) ? textValue(body?.module, 30) : "Speaking";
    const lessonId = textValue(body?.lessonId, 120) || null;
    const exerciseId = textValue(body?.exerciseId, 120) || null;
    const targetType = ["student", "cohort", "session"].includes(textValue(body?.targetType, 20)) ? textValue(body?.targetType, 20) : "student";
    const targetValue = textValue(body?.targetValue, 180);
    const dueAt = isoValue(body?.dueAt);
    if (!title || !instructions || !targetValue || !dueAt || dueAt <= now) return NextResponse.json({ error: "Complete the homework, recipient and future due date." }, { status: 400 });
    await getD1().prepare(`INSERT INTO homework_assignments (title, instructions, module, lesson_id, exercise_id, assigned_to_type, assigned_to_value, due_at, status, assigned_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`).bind(title, instructions, courseModule, lessonId, exerciseId, targetType, targetValue, dueAt, auth.user.email, now).run();
  } else if (action === "review_homework") {
    const assignmentId = numberValue(body?.assignmentId);
    const studentEmail = textValue(body?.studentEmail, 160).toLowerCase();
    const status = body?.status === "needs_revision" ? "needs_revision" : "completed";
    const comment = textValue(body?.teacherComment, 1000) || null;
    await getD1().prepare(`INSERT INTO homework_submissions (assignment_id, student_email, status, teacher_comment, reviewed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(assignment_id, student_email) DO UPDATE SET status = excluded.status, teacher_comment = excluded.teacher_comment, reviewed_at = excluded.reviewed_at, updated_at = excluded.updated_at`)
      .bind(assignmentId, studentEmail, status, comment, now, now).run();
  } else if (action === "add_note") {
    const studentEmail = textValue(body?.studentEmail, 160).toLowerCase();
    const note = textValue(body?.body, 2000);
    if (!emailPattern.test(studentEmail) || !note) return NextResponse.json({ error: "Choose a student and write a note." }, { status: 400 });
    await getD1().prepare("INSERT INTO student_notes (student_email, teacher_email, body, visible_to_student, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(studentEmail, auth.user.email, note, body?.visibleToStudent === true ? 1 : 0, now).run();
  } else {
    return NextResponse.json({ error: "Unsupported class-management action." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, snapshot: await getTeacherClassSnapshot(auth.user.email, auth.user.displayName) });
}
