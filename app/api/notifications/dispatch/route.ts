import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { dispatchQueuedEmails, generateScheduledNotifications } from "../../../../db/notifications";
import { getApiCreatorUser } from "../../../creator-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const secretAuthorized = Boolean(env.NOTIFICATION_CRON_SECRET && authorization === `Bearer ${env.NOTIFICATION_CRON_SECRET}`);
  if (!secretAuthorized) {
    const auth = await getApiCreatorUser("classes");
    if (!auth.user) return NextResponse.json({ error: "Valid scheduler secret or teacher access required" }, { status: auth.status });
  }
  const generated = await generateScheduledNotifications();
  const delivery = await dispatchQueuedEmails(100);
  return NextResponse.json({ ok: true, ...generated, ...delivery });
}
