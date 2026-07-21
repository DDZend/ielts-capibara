import { NextRequest, NextResponse } from "next/server";
import { dispatchQueuedEmails, generateScheduledNotifications, getCommunicationSnapshot, sendTeacherAnnouncement } from "../../../../db/notifications";
import { getApiCreatorUser } from "../../../creator-auth";

export const dynamic = "force-dynamic";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET() {
  const auth = await getApiCreatorUser("classes");
  if (!auth.user) return NextResponse.json({ error: auth.status === 401 ? "Authentication required" : "Teacher access required" }, { status: auth.status });
  return NextResponse.json({ snapshot: await getCommunicationSnapshot() });
}

export async function POST(request: NextRequest) {
  const auth = await getApiCreatorUser("classes");
  if (!auth.user) return NextResponse.json({ error: auth.status === 401 ? "Authentication required" : "Teacher access required" }, { status: auth.status });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = clean(body?.action, 30);
  if (action === "announcement") {
    const title = clean(body?.title, 180); const message = clean(body?.message, 2000);
    const audienceType = ["all", "cohort", "student"].includes(clean(body?.audienceType, 20)) ? clean(body?.audienceType, 20) as "all" | "cohort" | "student" : "all";
    const audienceValue = clean(body?.audienceValue, 180) || null;
    const actionUrl = clean(body?.actionUrl, 500) || "/dashboard";
    if (!title || !message) return NextResponse.json({ error: "Add an announcement title and message." }, { status: 400 });
    if (audienceType !== "all" && !audienceValue) return NextResponse.json({ error: "Choose a student or cohort." }, { status: 400 });
    const result = await sendTeacherAnnouncement({ title, message, audienceType, audienceValue, actionUrl, createdBy: auth.user.email });
    await dispatchQueuedEmails(30);
    return NextResponse.json({ ok: true, result, snapshot: await getCommunicationSnapshot() });
  }
  if (action === "run_automation") {
    const generated = await generateScheduledNotifications();
    const delivery = await dispatchQueuedEmails(50);
    return NextResponse.json({ ok: true, result: { ...generated, ...delivery }, snapshot: await getCommunicationSnapshot() });
  }
  if (action === "retry_failed") {
    const delivery = await dispatchQueuedEmails(50);
    return NextResponse.json({ ok: true, result: delivery, snapshot: await getCommunicationSnapshot() });
  }
  return NextResponse.json({ error: "Unsupported communication action." }, { status: 400 });
}
