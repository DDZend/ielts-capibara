import { NextRequest, NextResponse } from "next/server";
import { getTutorEscalations, resolveTutorEscalation } from "../../../../db/tutor";
import { getApiCreatorUser } from "../../../creator-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getApiCreatorUser("classes");
  if (!auth.user) return NextResponse.json({ error: auth.status === 401 ? "Authentication required" : "Teacher access required" }, { status: auth.status });
  return NextResponse.json({ escalations: await getTutorEscalations() });
}

export async function PATCH(request: NextRequest) {
  const auth = await getApiCreatorUser("classes");
  if (!auth.user) return NextResponse.json({ error: auth.status === 401 ? "Authentication required" : "Teacher access required" }, { status: auth.status });
  const body = await request.json().catch(() => null) as { id?: unknown; reply?: unknown } | null;
  const id = Math.trunc(Number(body?.id));
  const reply = typeof body?.reply === "string" ? body.reply.trim().slice(0, 1500) : "";
  if (!Number.isFinite(id) || id < 1 || reply.length < 2) return NextResponse.json({ error: "Choose a support request and write a helpful reply." }, { status: 400 });
  try {
    return NextResponse.json({ escalations: await resolveTutorEscalation({ id, reply, teacherEmail: auth.user.email }) });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "The reply could not be sent." }, { status: 409 });
  }
}
