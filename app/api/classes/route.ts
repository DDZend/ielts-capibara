import { NextRequest, NextResponse } from "next/server";
import { ensureAppSchema, getD1 } from "../../../db";
import { getStudentClassSnapshot, validateStudentBooking } from "../../../db/classes";
import { notifyStudentBooking } from "../../../db/notifications";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const int = (value: unknown) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
const clean = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return NextResponse.json({ snapshot: await getStudentClassSnapshot(user.email) });
}

export async function POST(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = clean(body?.action, 30);
  const now = new Date().toISOString();
  await ensureAppSchema();

  if (action === "book") {
    const sessionId = int(body?.sessionId);
    const validation = await validateStudentBooking(user.email, sessionId);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 409 });
    await getD1().prepare(`INSERT INTO class_bookings (session_id, student_email, status, booked_at, updated_at) VALUES (?, ?, 'booked', ?, ?)
      ON CONFLICT(session_id, student_email) DO UPDATE SET status = 'booked', cancelled_at = NULL, cancellation_reason = NULL, updated_at = excluded.updated_at`)
      .bind(sessionId, user.email, now, now).run();
    await notifyStudentBooking(user.email, sessionId, "booked");
  } else if (action === "cancel") {
    const sessionId = int(body?.sessionId);
    const reason = clean(body?.reason, 300) || "Cancelled by student";
    const session = await getD1().prepare("SELECT starts_at FROM class_sessions WHERE id = ? LIMIT 1").bind(sessionId).first<{ starts_at: string }>();
    if (!session) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    const late = new Date(session.starts_at).getTime() - Date.now() < 24 * 60 * 60 * 1000;
    await getD1().prepare(`UPDATE class_bookings SET status = 'cancelled', cancelled_at = ?, cancellation_reason = ?, updated_at = ?
      WHERE session_id = ? AND student_email = ? AND status = 'booked'`).bind(now, `${late ? "Late cancellation: " : ""}${reason}`, now, sessionId, user.email).run();
  } else if (action === "reschedule") {
    const fromSessionId = int(body?.fromSessionId);
    const toSessionId = int(body?.toSessionId);
    const existing = await getD1().prepare("SELECT 1 AS booked FROM class_bookings WHERE session_id = ? AND student_email = ? AND status = 'booked' LIMIT 1").bind(fromSessionId, user.email).first();
    if (!existing) return NextResponse.json({ error: "The original booking is not active." }, { status: 409 });
    const validation = await validateStudentBooking(user.email, toSessionId, fromSessionId);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 409 });
    await getD1().batch([
      getD1().prepare("UPDATE class_bookings SET status = 'rescheduled', cancelled_at = ?, cancellation_reason = 'Rescheduled by student', updated_at = ? WHERE session_id = ? AND student_email = ? AND status = 'booked'").bind(now, now, fromSessionId, user.email),
      getD1().prepare(`INSERT INTO class_bookings (session_id, student_email, status, booked_at, rescheduled_from_session_id, updated_at)
        VALUES (?, ?, 'booked', ?, ?, ?) ON CONFLICT(session_id, student_email) DO UPDATE SET status = 'booked', cancelled_at = NULL, cancellation_reason = NULL, rescheduled_from_session_id = excluded.rescheduled_from_session_id, updated_at = excluded.updated_at`)
        .bind(toSessionId, user.email, now, fromSessionId, now),
    ]);
    await notifyStudentBooking(user.email, toSessionId, "rescheduled");
  } else if (action === "submit_homework") {
    const assignmentId = int(body?.assignmentId);
    const note = clean(body?.studentNote, 2000);
    if (!assignmentId || !note) return NextResponse.json({ error: "Add your homework note or response before submitting." }, { status: 400 });
    await getD1().prepare(`INSERT INTO homework_submissions (assignment_id, student_email, status, student_note, submitted_at, updated_at)
      VALUES (?, ?, 'submitted', ?, ?, ?) ON CONFLICT(assignment_id, student_email) DO UPDATE SET status = 'submitted', student_note = excluded.student_note, submitted_at = excluded.submitted_at, updated_at = excluded.updated_at`)
      .bind(assignmentId, user.email, note, now, now).run();
  } else {
    return NextResponse.json({ error: "Unsupported class action." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, snapshot: await getStudentClassSnapshot(user.email) });
}
