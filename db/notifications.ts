import { env } from "cloudflare:workers";
import { ensureAppSchema, getD1 } from ".";
import {
  defaultNotificationPreferences,
  type CommunicationSnapshot,
  type NotificationCategory,
  type NotificationCenterSnapshot,
  type NotificationDelivery,
  type NotificationPreferences,
} from "../lib/notifications";

type PreferenceRow = Record<string, unknown>;
type NotificationInput = {
  userEmail: string;
  sourceKey?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  actionUrl?: string | null;
  priority?: "normal" | "important";
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const categoryPreference: Record<NotificationCategory, keyof NotificationPreferences> = {
  upcoming_class: "upcomingClasses",
  new_homework: "newHomework",
  homework_deadline: "homeworkDeadlines",
  teacher_comment: "teacherComments",
  weekend_mock: "weekendMock",
  membership: "membership",
  sponsored_pass: "sponsoredPass",
  weekly_report: "weeklyReport",
  announcement: "announcements",
};

const bool = (value: unknown, fallback = true) => value == null ? fallback : Boolean(value);
const asPreferences = (row?: PreferenceRow | null): NotificationPreferences => row ? {
  inAppEnabled: bool(row.in_app_enabled),
  emailEnabled: bool(row.email_enabled),
  upcomingClasses: bool(row.upcoming_classes),
  newHomework: bool(row.new_homework),
  homeworkDeadlines: bool(row.homework_deadlines),
  teacherComments: bool(row.teacher_comments),
  weekendMock: bool(row.weekend_mock),
  membership: bool(row.membership),
  sponsoredPass: bool(row.sponsored_pass),
  weeklyReport: bool(row.weekly_report),
  announcements: bool(row.announcements),
  quietStart: String(row.quiet_start || "22:00"),
  quietEnd: String(row.quiet_end || "08:00"),
  timezone: String(row.timezone || "Asia/Almaty"),
} : { ...defaultNotificationPreferences };

function isEmailConfigured() {
  return Boolean(env.RESEND_API_KEY && env.NOTIFICATION_FROM_EMAIL);
}

async function getPreferences(email: string) {
  const row = await getD1().prepare("SELECT * FROM notification_preferences WHERE user_email = ? LIMIT 1").bind(email.toLowerCase()).first<PreferenceRow>();
  return asPreferences(row);
}

function isQuietNow(preferences: NotificationPreferences, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: preferences.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
    const current = hour * 60 + minute;
    const [startHour, startMinute] = preferences.quietStart.split(":").map(Number);
    const [endHour, endMinute] = preferences.quietEnd.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    if (start === end) return false;
    return start < end ? current >= start && current < end : current >= start || current < end;
  } catch {
    return false;
  }
}

export async function createNotification(input: NotificationInput) {
  await ensureAppSchema();
  const email = input.userEmail.trim().toLowerCase();
  if (!emailPattern.test(email)) return null;
  const now = new Date().toISOString();
  const sourceKey = input.sourceKey ? `${input.sourceKey}:${email}` : `manual:${crypto.randomUUID()}:${email}`;
  const preferences = await getPreferences(email);
  await getD1().prepare(`INSERT OR IGNORE INTO notifications
    (user_email, source_key, category, title, message, action_url, priority, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(email, sourceKey, input.category, input.title.slice(0, 180), input.message.slice(0, 2000), input.actionUrl ?? null, input.priority ?? "normal", preferences.inAppEnabled ? "unread" : "archived", now).run();
  const notification = await getD1().prepare("SELECT id FROM notifications WHERE source_key = ? LIMIT 1").bind(sourceKey).first<{ id: number }>();
  if (!notification) return null;
  const categoryEnabled = Boolean(preferences[categoryPreference[input.category]]);
  const deliveryStatus = preferences.emailEnabled && categoryEnabled ? "queued" : "skipped";
  const deliveryError = deliveryStatus === "skipped" ? "Disabled in notification preferences" : null;
  await getD1().prepare(`INSERT OR IGNORE INTO notification_deliveries
    (notification_id, user_email, channel, status, attempts, last_error, created_at, updated_at)
    VALUES (?, ?, 'email', ?, 0, ?, ?, ?)`)
    .bind(notification.id, email, deliveryStatus, deliveryError, now, now).run();
  return notification.id;
}

function mapDelivery(row: Record<string, unknown>): NotificationDelivery {
  return {
    id: Number(row.id), notificationId: Number(row.notification_id), userEmail: String(row.user_email), title: String(row.title), channel: "email",
    status: String(row.status) as NotificationDelivery["status"], attempts: Number(row.attempts), lastError: row.last_error == null ? null : String(row.last_error),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), sentAt: row.sent_at == null ? null : String(row.sent_at), openedAt: row.opened_at == null ? null : String(row.opened_at),
  };
}

export async function getNotificationCenter(email: string): Promise<NotificationCenterSnapshot> {
  await ensureAppSchema();
  const normalized = email.toLowerCase();
  const [notifications, unread, deliveries, preferences] = await Promise.all([
    getD1().prepare(`SELECT id, category, title, message, action_url, priority, status, created_at, read_at
      FROM notifications WHERE user_email = ? AND status != 'archived' ORDER BY created_at DESC LIMIT 60`).bind(normalized).all<Record<string, unknown>>(),
    getD1().prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_email = ? AND status = 'unread'").bind(normalized).first<{ count: number }>(),
    getD1().prepare(`SELECT d.*, n.title FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id
      WHERE d.user_email = ? ORDER BY d.created_at DESC LIMIT 20`).bind(normalized).all<Record<string, unknown>>(),
    getPreferences(normalized),
  ]);
  return {
    notifications: (notifications.results ?? []).map((row) => ({
      id: Number(row.id), category: String(row.category) as NotificationCategory, title: String(row.title), message: String(row.message),
      actionUrl: row.action_url == null ? null : String(row.action_url), priority: String(row.priority) as "normal" | "important",
      status: String(row.status) as "unread" | "read" | "archived", createdAt: String(row.created_at), readAt: row.read_at == null ? null : String(row.read_at),
    })),
    unreadCount: Number(unread?.count ?? 0), preferences, deliveries: (deliveries.results ?? []).map(mapDelivery), emailConfigured: isEmailConfigured(),
  };
}

export async function markNotificationsRead(email: string, notificationId?: number) {
  await ensureAppSchema();
  const now = new Date().toISOString();
  if (notificationId) {
    await getD1().prepare("UPDATE notifications SET status = 'read', read_at = COALESCE(read_at, ?), opened_at = COALESCE(opened_at, ?) WHERE id = ? AND user_email = ?")
      .bind(now, now, notificationId, email.toLowerCase()).run();
  } else {
    await getD1().prepare("UPDATE notifications SET status = 'read', read_at = COALESCE(read_at, ?), opened_at = COALESCE(opened_at, ?) WHERE user_email = ? AND status = 'unread'")
      .bind(now, now, email.toLowerCase()).run();
  }
}

export async function updateNotificationPreferences(email: string, input: Partial<NotificationPreferences>) {
  await ensureAppSchema();
  const current = await getPreferences(email);
  const next = { ...current, ...input };
  if (!/^\d{2}:\d{2}$/.test(next.quietStart)) next.quietStart = current.quietStart;
  if (!/^\d{2}:\d{2}$/.test(next.quietEnd)) next.quietEnd = current.quietEnd;
  try { new Intl.DateTimeFormat("en", { timeZone: next.timezone }).format(); } catch { next.timezone = current.timezone; }
  const now = new Date().toISOString();
  await getD1().prepare(`INSERT INTO notification_preferences
    (user_email, in_app_enabled, email_enabled, upcoming_classes, new_homework, homework_deadlines, teacher_comments,
      weekend_mock, membership, sponsored_pass, weekly_report, announcements, quiet_start, quiet_end, timezone, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email) DO UPDATE SET in_app_enabled = excluded.in_app_enabled, email_enabled = excluded.email_enabled,
      upcoming_classes = excluded.upcoming_classes, new_homework = excluded.new_homework, homework_deadlines = excluded.homework_deadlines,
      teacher_comments = excluded.teacher_comments, weekend_mock = excluded.weekend_mock, membership = excluded.membership,
      sponsored_pass = excluded.sponsored_pass, weekly_report = excluded.weekly_report, announcements = excluded.announcements,
      quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end, timezone = excluded.timezone, updated_at = excluded.updated_at`)
    .bind(email.toLowerCase(), Number(next.inAppEnabled), Number(next.emailEnabled), Number(next.upcomingClasses), Number(next.newHomework), Number(next.homeworkDeadlines), Number(next.teacherComments), Number(next.weekendMock), Number(next.membership), Number(next.sponsoredPass), Number(next.weeklyReport), Number(next.announcements), next.quietStart, next.quietEnd, next.timezone, now).run();
  return next;
}

async function allStudentEmails() {
  const rows = await getD1().prepare(`WITH student_emails AS (
    SELECT user_email AS email FROM assessment_results UNION SELECT user_email FROM study_tasks
    UNION SELECT user_email FROM lesson_progress UNION SELECT user_email FROM ai_practice_assessments
    UNION SELECT user_email FROM subscriptions UNION SELECT user_email FROM manual_access_grants
    UNION SELECT student_email FROM cohort_members UNION SELECT student_email FROM student_teacher_assignments
    UNION SELECT recipient_email FROM sponsored_access_passes WHERE recipient_email IS NOT NULL
  ) SELECT LOWER(email) AS email FROM student_emails WHERE email IS NOT NULL ORDER BY email`).all<{ email: string }>();
  return (rows.results ?? []).map((row) => row.email).filter((email) => emailPattern.test(email));
}

async function resolveAudience(type: string, value?: string | null) {
  if (type === "student") return value && emailPattern.test(value) ? [value.toLowerCase()] : [];
  if (type === "cohort") {
    const rows = await getD1().prepare("SELECT student_email FROM cohort_members WHERE cohort_id = ? AND status = 'active'").bind(Number(value)).all<{ student_email: string }>();
    return (rows.results ?? []).map((row) => row.student_email.toLowerCase());
  }
  if (type === "session") {
    const rows = await getD1().prepare("SELECT student_email FROM class_bookings WHERE session_id = ? AND status = 'booked'").bind(Number(value)).all<{ student_email: string }>();
    return (rows.results ?? []).map((row) => row.student_email.toLowerCase());
  }
  return allStudentEmails();
}

export async function sendTeacherAnnouncement(input: { title: string; message: string; audienceType: "all" | "cohort" | "student"; audienceValue?: string | null; actionUrl?: string | null; createdBy: string }) {
  await ensureAppSchema();
  const recipients = [...new Set(await resolveAudience(input.audienceType, input.audienceValue))];
  const now = new Date().toISOString();
  const inserted = await getD1().prepare(`INSERT INTO teacher_announcements
    (title, message, audience_type, audience_value, action_url, recipient_count, status, created_by, created_at, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?)`)
    .bind(input.title.slice(0, 180), input.message.slice(0, 2000), input.audienceType, input.audienceValue ?? null, input.actionUrl ?? null, recipients.length, input.createdBy, now, now).run();
  const announcementId = Number(inserted.meta.last_row_id);
  await Promise.all(recipients.map((userEmail) => createNotification({
    userEmail, sourceKey: `announcement:${announcementId}`, category: "announcement", title: input.title,
    message: input.message, actionUrl: input.actionUrl ?? "/dashboard", priority: "important",
  })));
  return { announcementId, recipientCount: recipients.length };
}

export async function notifyClassScheduled(sessionId: number) {
  await ensureAppSchema();
  const session = await getD1().prepare("SELECT id, title, session_type, cohort_id, student_email, teacher_email, starts_at FROM class_sessions WHERE id = ? LIMIT 1").bind(sessionId).first<Record<string, unknown>>();
  if (!session) return;
  const recipients = session.session_type === "individual" ? [String(session.student_email || "")] : await resolveAudience("cohort", String(session.cohort_id));
  const starts = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(session.starts_at)));
  await Promise.all([...new Set(recipients.filter(Boolean))].map((userEmail) => createNotification({ userEmail, sourceKey: `class-scheduled:${sessionId}`, category: "upcoming_class", title: "A new class is ready", message: `${String(session.title)} is scheduled for ${starts}.`, actionUrl: "/classes" })));
  await createNotification({ userEmail: String(session.teacher_email), sourceKey: `teacher-class-scheduled:${sessionId}`, category: "upcoming_class", title: "Class added to your schedule", message: `${String(session.title)} starts ${starts}.`, actionUrl: "/creator/classes" });
}

export async function notifyClassCancelled(sessionId: number, reason: string) {
  const session = await getD1().prepare("SELECT title, teacher_email FROM class_sessions WHERE id = ? LIMIT 1").bind(sessionId).first<{ title: string; teacher_email: string }>();
  if (!session) return;
  const recipients = await resolveAudience("session", String(sessionId));
  await Promise.all([...new Set([...recipients, session.teacher_email])].map((userEmail) => createNotification({ userEmail, sourceKey: `class-cancelled:${sessionId}`, category: "upcoming_class", title: "Class cancelled", message: `${session.title} was cancelled. ${reason}`, actionUrl: userEmail === session.teacher_email ? "/creator/classes" : "/classes", priority: "important" })));
}

export async function notifyStudentBooking(userEmail: string, sessionId: number, kind: "booked" | "rescheduled" = "booked") {
  const session = await getD1().prepare("SELECT title, starts_at FROM class_sessions WHERE id = ? LIMIT 1").bind(sessionId).first<{ title: string; starts_at: string }>();
  if (!session) return;
  const starts = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.starts_at));
  await createNotification({ userEmail, sourceKey: `class-${kind}:${sessionId}`, category: "upcoming_class", title: kind === "booked" ? "Class booked" : "Class rescheduled", message: `${session.title} is confirmed for ${starts}.`, actionUrl: "/classes" });
}

export async function notifyHomeworkAssigned(assignmentId: number) {
  const assignment = await getD1().prepare("SELECT title, module, assigned_to_type, assigned_to_value, due_at FROM homework_assignments WHERE id = ? LIMIT 1").bind(assignmentId).first<Record<string, unknown>>();
  if (!assignment) return;
  const recipients = await resolveAudience(String(assignment.assigned_to_type), String(assignment.assigned_to_value));
  const due = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(assignment.due_at)));
  await Promise.all([...new Set(recipients)].map((userEmail) => createNotification({ userEmail, sourceKey: `homework-assigned:${assignmentId}`, category: "new_homework", title: "New homework assigned", message: `${String(assignment.title)} (${String(assignment.module)}) is due ${due}.`, actionUrl: "/classes", priority: "important" })));
}

export async function notifyTeacherComment(userEmail: string, source: string, message: string) {
  await createNotification({ userEmail, sourceKey: `teacher-comment:${source}`, category: "teacher_comment", title: "New teacher comment", message, actionUrl: "/classes", priority: "important" });
}

export async function mirrorBillingNotification(input: { userEmail: string; eventId?: string | null; kind: string; title: string; message: string; actionUrl?: string | null }) {
  await createNotification({ userEmail: input.userEmail, sourceKey: `billing:${input.eventId ?? `${input.kind}:${crypto.randomUUID()}`}`, category: "membership", title: input.title, message: input.message, actionUrl: input.actionUrl ?? "/billing", priority: "important" });
}

export async function generateScheduledNotifications(date = new Date()) {
  await ensureAppSchema();
  const now = date.toISOString();
  const in25Hours = new Date(date.getTime() + 25 * 60 * 60 * 1000).toISOString();
  const in24Hours = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const in7Days = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const jobs: Array<Promise<unknown>> = [];

  const classes = await getD1().prepare(`SELECT cs.id, cs.title, cs.starts_at, cs.teacher_email, b.student_email
    FROM class_sessions cs JOIN class_bookings b ON b.session_id = cs.id AND b.status = 'booked'
    WHERE cs.status = 'scheduled' AND cs.starts_at > ? AND cs.starts_at <= ?`).bind(now, in25Hours).all<Record<string, unknown>>();
  for (const row of classes.results ?? []) {
    const starts = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(row.starts_at)));
    jobs.push(createNotification({ userEmail: String(row.student_email), sourceKey: `class-reminder:${row.id}`, category: "upcoming_class", title: "Class starts within 24 hours", message: `${String(row.title)} starts ${starts}. Your meeting link is waiting in Classes.`, actionUrl: "/classes", priority: "important" }));
    jobs.push(createNotification({ userEmail: String(row.teacher_email), sourceKey: `teacher-class-reminder:${row.id}`, category: "upcoming_class", title: "Teaching reminder", message: `${String(row.title)} starts ${starts}.`, actionUrl: "/creator/classes", priority: "important" }));
  }

  const homework = await getD1().prepare(`SELECT id, title, assigned_to_type, assigned_to_value, due_at FROM homework_assignments
    WHERE status = 'active' AND due_at > ? AND due_at <= ?`).bind(now, in24Hours).all<Record<string, unknown>>();
  for (const row of homework.results ?? []) {
    const recipients = await resolveAudience(String(row.assigned_to_type), String(row.assigned_to_value));
    const due = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(row.due_at)));
    for (const userEmail of recipients) {
      const complete = await getD1().prepare("SELECT 1 AS done FROM homework_submissions WHERE assignment_id = ? AND student_email = ? AND status = 'completed' LIMIT 1").bind(Number(row.id), userEmail).first();
      if (!complete) jobs.push(createNotification({ userEmail, sourceKey: `homework-deadline:${row.id}`, category: "homework_deadline", title: "Homework due within 24 hours", message: `${String(row.title)} is due ${due}.`, actionUrl: "/classes", priority: "important" }));
    }
  }

  const expiring = await getD1().prepare(`SELECT user_email, current_period_end AS expires_at FROM subscriptions WHERE status IN ('active','trialing','past_due') AND current_period_end > ? AND current_period_end <= ?
    UNION SELECT user_email, expires_at FROM manual_access_grants WHERE status = 'active' AND expires_at > ? AND expires_at <= ?`).bind(now, in7Days, now, in7Days).all<{ user_email: string; expires_at: string }>();
  for (const row of expiring.results ?? []) {
    const days = Math.max(1, Math.ceil((new Date(row.expires_at).getTime() - date.getTime()) / 86400000));
    jobs.push(createNotification({ userEmail: row.user_email, sourceKey: `membership-expiry:${row.expires_at}:${days <= 1 ? "1d" : "7d"}`, category: "membership", title: days <= 1 ? "Membership expires tomorrow" : "Membership renewal reminder", message: `Your platform access expires in ${days} day${days === 1 ? "" : "s"}. Review your membership to avoid interruption.`, actionUrl: "/billing", priority: "important" }));
  }

  const passEnd = new Date(date.getTime() + 6 * 60 * 60 * 1000).toISOString();
  const passes = await getD1().prepare("SELECT id, recipient_email, expires_at FROM sponsored_access_passes WHERE status = 'claimed' AND recipient_email IS NOT NULL AND expires_at > ? AND expires_at <= ?").bind(now, passEnd).all<{ id: number; recipient_email: string; expires_at: string }>();
  for (const row of passes.results ?? []) jobs.push(createNotification({ userEmail: row.recipient_email, sourceKey: `sponsored-pass-expiry:${row.id}`, category: "sponsored_pass", title: "Sponsored access ends soon", message: "Your sponsored 24-hour pass expires within six hours. Save your work and choose a package to continue.", actionUrl: "/billing", priority: "important" }));

  const weekday = date.getUTCDay();
  const week = new Date(date); week.setUTCDate(date.getUTCDate() - ((weekday + 6) % 7)); week.setUTCHours(0, 0, 0, 0);
  const weekKey = week.toISOString().slice(0, 10);
  if (weekday === 5 || weekday === 6) {
    for (const userEmail of await allStudentEmails()) jobs.push(createNotification({ userEmail, sourceKey: `weekend-mock:${weekKey}`, category: "weekend_mock", title: "Your weekend mock is ready", message: "Complete all four skills, then compare this result with last week.", actionUrl: "/mock-test", priority: "important" }));
  }
  if (weekday === 0 || weekday === 1) {
    for (const userEmail of await allStudentEmails()) {
      const report = await getD1().prepare(`SELECT
        (SELECT COUNT(*) FROM lesson_progress WHERE user_email = ? AND completed_at >= ?) AS lessons,
        (SELECT AVG(score) FROM lesson_progress WHERE user_email = ? AND completed_at >= ?) AS average,
        (SELECT overall_band FROM mock_results WHERE user_email = ? ORDER BY created_at DESC LIMIT 1) AS mock_band`).bind(userEmail, weekKey, userEmail, weekKey, userEmail).first<Record<string, unknown>>();
      const average = report?.average == null ? "No scored exercises yet" : `${Math.round(Number(report.average))}% exercise average`;
      const mock = report?.mock_band == null ? "Your weekend mock is still waiting" : `latest mock Band ${Number(report.mock_band).toFixed(1)}`;
      jobs.push(createNotification({ userEmail, sourceKey: `weekly-report:${weekKey}`, category: "weekly_report", title: "Your weekly progress report", message: `${Number(report?.lessons ?? 0)} lessons completed, ${average}, and ${mock}. Open your dashboard for the full comparison and adjusted plan.`, actionUrl: "/dashboard#learning-journey" }));
    }
  }
  await Promise.all(jobs);
  return { generated: jobs.length };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
function emailHtml(title: string, message: string, actionUrl: string | null) {
  const base = (env.PUBLIC_SITE_URL || "https://ielts-mastery-capi.danamanbek.chatgpt.site").replace(/\/$/, "");
  const href = actionUrl ? (actionUrl.startsWith("http") ? actionUrl : `${base}${actionUrl.startsWith("/") ? "" : "/"}${actionUrl}`) : `${base}/dashboard`;
  return `<!doctype html><html><body style="margin:0;background:#f2f6f2;font-family:Arial,sans-serif;color:#17231b"><div style="max-width:600px;margin:0 auto;padding:32px 18px"><div style="padding:14px 20px;background:#126d36;color:white;border-radius:16px 16px 0 0;font-weight:700">IELTS Mastery · Capy Coach</div><div style="padding:30px 24px;background:white;border:1px solid #dce6dd;border-top:0;border-radius:0 0 16px 16px"><h1 style="font-size:24px;margin:0 0 12px">${escapeHtml(title)}</h1><p style="font-size:15px;line-height:1.6;color:#56645a">${escapeHtml(message)}</p><a href="${escapeHtml(href)}" style="display:inline-block;margin-top:12px;padding:12px 18px;border-radius:9px;background:#16803e;color:white;text-decoration:none;font-weight:700">Open IELTS Mastery</a><p style="margin:28px 0 0;color:#879188;font-size:12px">Change email alerts and quiet hours from the notification centre in your dashboard.</p></div></div></body></html>`;
}

export async function dispatchQueuedEmails(limit = 25) {
  await ensureAppSchema();
  const now = new Date().toISOString();
  const rows = await getD1().prepare(`SELECT d.id, d.notification_id, d.user_email, d.attempts, n.title, n.message, n.action_url
    FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id
    WHERE d.channel = 'email' AND d.attempts < 5 AND d.status IN ('queued','failed','configuration_required')
      AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= ?) ORDER BY d.created_at LIMIT ?`).bind(now, Math.max(1, Math.min(100, limit))).all<Record<string, unknown>>();
  let sent = 0; let failed = 0; let deferred = 0;
  for (const row of rows.results ?? []) {
    const id = Number(row.id); const attempts = Number(row.attempts);
    if (!isEmailConfigured()) {
      await getD1().prepare("UPDATE notification_deliveries SET status = 'configuration_required', last_error = 'Add RESEND_API_KEY and NOTIFICATION_FROM_EMAIL to enable outbound email.', updated_at = ? WHERE id = ?").bind(now, id).run();
      failed += 1; continue;
    }
    const preferences = await getPreferences(String(row.user_email));
    if (isQuietNow(preferences)) {
      const next = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await getD1().prepare("UPDATE notification_deliveries SET status = 'queued', next_attempt_at = ?, last_error = 'Deferred during quiet hours', updated_at = ? WHERE id = ?").bind(next, now, id).run();
      deferred += 1; continue;
    }
    await getD1().prepare("UPDATE notification_deliveries SET status = 'sending', updated_at = ? WHERE id = ?").bind(now, id).run();
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `notification-email-${id}` },
        body: JSON.stringify({ from: env.NOTIFICATION_FROM_EMAIL, to: [String(row.user_email)], subject: String(row.title), html: emailHtml(String(row.title), String(row.message), row.action_url == null ? null : String(row.action_url)) }),
      });
      const data = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
      if (!response.ok || !data.id) throw new Error(data.message || data.name || `Email provider returned ${response.status}`);
      const sentAt = new Date().toISOString();
      await getD1().prepare("UPDATE notification_deliveries SET status = 'sent', attempts = ?, provider_message_id = ?, last_error = NULL, next_attempt_at = NULL, sent_at = ?, updated_at = ? WHERE id = ?")
        .bind(attempts + 1, data.id, sentAt, sentAt, id).run();
      sent += 1;
    } catch (error) {
      const nextAttempt = attempts + 1;
      const delays = [5, 30, 120, 360, 1440];
      const retryAt = nextAttempt < 5 ? new Date(Date.now() + delays[Math.min(nextAttempt - 1, delays.length - 1)] * 60000).toISOString() : null;
      await getD1().prepare("UPDATE notification_deliveries SET status = 'failed', attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE id = ?")
        .bind(nextAttempt, retryAt, error instanceof Error ? error.message.slice(0, 500) : "Email delivery failed", new Date().toISOString(), id).run();
      failed += 1;
    }
  }
  return { considered: rows.results?.length ?? 0, sent, failed, deferred };
}

export async function getCommunicationSnapshot(): Promise<CommunicationSnapshot> {
  await ensureAppSchema();
  const [stats, deliveries, announcements, students, cohorts] = await Promise.all([
    getD1().prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN n.status = 'unread' THEN 1 ELSE 0 END) AS unread,
      SUM(CASE WHEN d.status IN ('queued','sending','configuration_required') THEN 1 ELSE 0 END) AS queued,
      SUM(CASE WHEN d.status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN d.status = 'opened' THEN 1 ELSE 0 END) AS opened,
      SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END) AS failed
      FROM notifications n LEFT JOIN notification_deliveries d ON d.notification_id = n.id`).first<Record<string, unknown>>(),
    getD1().prepare(`SELECT d.*, n.title FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id ORDER BY d.created_at DESC LIMIT 150`).all<Record<string, unknown>>(),
    getD1().prepare("SELECT id, title, message, audience_type, audience_value, recipient_count, created_by, sent_at FROM teacher_announcements ORDER BY created_at DESC LIMIT 80").all<Record<string, unknown>>(),
    getD1().prepare(`WITH student_emails AS (SELECT user_email AS email FROM assessment_results UNION SELECT user_email FROM lesson_progress UNION SELECT user_email FROM subscriptions UNION SELECT student_email FROM cohort_members)
      SELECT e.email, COALESCE((SELECT user_name FROM assessment_results a WHERE a.user_email = e.email ORDER BY a.created_at DESC LIMIT 1), e.email) AS label FROM student_emails e ORDER BY label`).all<{ email: string; label: string }>(),
    getD1().prepare("SELECT c.id, c.name, COUNT(cm.id) AS member_count FROM cohorts c LEFT JOIN cohort_members cm ON cm.cohort_id = c.id AND cm.status = 'active' WHERE c.status = 'active' GROUP BY c.id ORDER BY c.name").all<Record<string, unknown>>(),
  ]);
  return {
    stats: { total: Number(stats?.total ?? 0), unread: Number(stats?.unread ?? 0), queued: Number(stats?.queued ?? 0), sent: Number(stats?.sent ?? 0), opened: Number(stats?.opened ?? 0), failed: Number(stats?.failed ?? 0) },
    deliveries: (deliveries.results ?? []).map(mapDelivery),
    announcements: (announcements.results ?? []).map((row) => ({ id: Number(row.id), title: String(row.title), message: String(row.message), audienceType: String(row.audience_type), audienceValue: row.audience_value == null ? null : String(row.audience_value), recipientCount: Number(row.recipient_count), createdBy: String(row.created_by), sentAt: String(row.sent_at) })),
    students: (students.results ?? []).map((row) => ({ email: row.email, label: row.label })),
    cohorts: (cohorts.results ?? []).map((row) => ({ id: Number(row.id), name: String(row.name), memberCount: Number(row.member_count) })),
    emailConfigured: isEmailConfigured(),
  };
}

export async function recordEmailProviderEvent(input: { webhookId: string; providerMessageId: string; eventType: string; occurredAt: string; payload: string }) {
  await ensureAppSchema();
  const now = new Date().toISOString();
  const inserted = await getD1().prepare(`INSERT OR IGNORE INTO notification_delivery_events
    (webhook_id, provider_message_id, event_type, occurred_at, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(input.webhookId, input.providerMessageId, input.eventType, input.occurredAt, input.payload.slice(0, 100000), now).run();
  if (Number(inserted.meta.changes ?? 0) === 0) return { duplicate: true };
  let status: string | null = null;
  if (input.eventType === "email.sent") status = "sent";
  else if (input.eventType === "email.delivered") status = "delivered";
  else if (input.eventType === "email.opened" || input.eventType === "email.clicked") status = "opened";
  else if (["email.failed", "email.bounced", "email.suppressed", "email.complained"].includes(input.eventType)) status = "failed";
  if (status) {
    const openedAt = status === "opened" ? input.occurredAt : null;
    const error = status === "failed" ? `Provider event: ${input.eventType}` : null;
    await getD1().prepare(`UPDATE notification_deliveries SET status = ?, opened_at = COALESCE(?, opened_at), last_error = COALESCE(?, last_error), updated_at = ? WHERE provider_message_id = ?`)
      .bind(status, openedAt, error, now, input.providerMessageId).run();
  }
  return { duplicate: false };
}
