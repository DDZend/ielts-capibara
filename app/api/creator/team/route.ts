import { NextResponse } from "next/server";
import { getTeamAdminSnapshot, inviteTeacher, reviewTeacherRequest, updateTeacher } from "../../../../db/staff";
import { getApiOwnerUser } from "../../../creator-auth";

export const dynamic = "force-dynamic";

function authError(status: 401 | 403) {
  return NextResponse.json({ error: status === 401 ? "Sign in required." : "Only the school owner can manage teacher access." }, { status });
}

export async function GET() {
  const auth = await getApiOwnerUser();
  if (!auth.user) return authError(auth.status);
  return NextResponse.json({ snapshot: await getTeamAdminSnapshot() });
}

export async function POST(request: Request) {
  const auth = await getApiOwnerUser();
  if (!auth.user) return authError(auth.status);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.email !== "string") return NextResponse.json({ error: "Enter a teacher email address." }, { status: 400 });
  try {
    const snapshot = await inviteTeacher({
      email: body.email,
      displayName: typeof body.displayName === "string" ? body.displayName : undefined,
      permissions: body.permissions,
      invitedBy: auth.user.email,
    });
    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not invite this teacher." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await getApiOwnerUser();
  if (!auth.user) return authError(auth.status);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.email !== "string" || typeof body.action !== "string") return NextResponse.json({ error: "Choose a valid teacher action." }, { status: 400 });
  try {
    const snapshot = body.action === "review_request"
      ? await reviewTeacherRequest({
        email: body.email,
        decision: body.decision === "approved" ? "approved" : "declined",
        reviewedBy: auth.user.email,
        permissions: body.permissions,
      })
      : await updateTeacher({
        email: body.email,
        status: body.status,
        permissions: body.permissions,
        updatedBy: auth.user.email,
      });
    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update this teacher." }, { status: 400 });
  }
}
