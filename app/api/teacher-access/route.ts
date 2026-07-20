import { NextResponse } from "next/server";
import { getStaffAccess, requestTeacherAccess, staffHasPermission } from "../../../db/staff";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Sign in before requesting teacher access." }, { status: 401 });
  const staff = await getStaffAccess(user.email, user.displayName);
  if (staffHasPermission(staff)) return NextResponse.json({ error: "Your teacher account is already active." }, { status: 409 });
  if (staff?.status === "inactive") return NextResponse.json({ error: "Ask the school owner to reactivate this teacher account." }, { status: 403 });
  const body = await request.json().catch(() => null) as { message?: unknown } | null;
  if (body?.message !== undefined && typeof body.message !== "string") return NextResponse.json({ error: "The note must be text." }, { status: 400 });
  const accessRequest = await requestTeacherAccess(user.email, user.displayName, body?.message ?? "");
  return NextResponse.json({ request: accessRequest });
}
