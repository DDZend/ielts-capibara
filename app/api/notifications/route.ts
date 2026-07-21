import { NextRequest, NextResponse } from "next/server";
import { dispatchQueuedEmails, generateScheduledNotifications, getNotificationCenter, markNotificationsRead, updateNotificationPreferences } from "../../../db/notifications";
import type { NotificationPreferences } from "../../../lib/notifications";
import { getApiLearningUser } from "../../learning-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getApiLearningUser();
  if (!access.user) return NextResponse.json({ error: access.status === 401 ? "Authentication required" : "Active access required" }, { status: access.status });
  await generateScheduledNotifications();
  await dispatchQueuedEmails(8);
  return NextResponse.json({ snapshot: await getNotificationCenter(access.user.email) });
}

export async function PATCH(request: NextRequest) {
  const access = await getApiLearningUser();
  if (!access.user) return NextResponse.json({ error: access.status === 401 ? "Authentication required" : "Active access required" }, { status: access.status });
  const body = await request.json().catch(() => null) as { action?: string; notificationId?: number; preferences?: Partial<NotificationPreferences> } | null;
  if (body?.action === "read") await markNotificationsRead(access.user.email, Number(body.notificationId) || undefined);
  else if (body?.action === "read_all") await markNotificationsRead(access.user.email);
  else if (body?.action === "preferences" && body.preferences) await updateNotificationPreferences(access.user.email, body.preferences);
  else return NextResponse.json({ error: "Unsupported notification action." }, { status: 400 });
  return NextResponse.json({ ok: true, snapshot: await getNotificationCenter(access.user.email) });
}
