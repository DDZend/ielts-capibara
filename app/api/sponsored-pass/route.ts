import { NextRequest, NextResponse } from "next/server";
import { ensureAppSchema, getD1 } from "../../../db";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const code = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
  if (typeof code !== "string" || !/^[A-Z0-9]{12}$/.test(code)) return NextResponse.json({ error: "This pass link is invalid." }, { status: 400 });
  await ensureAppSchema();
  const pass = await getD1().prepare("SELECT donor_email, recipient_email, status, expires_at, access_hours FROM sponsored_access_passes WHERE pass_code = ? LIMIT 1")
    .bind(code).first<{ donor_email: string; recipient_email: string | null; status: string; expires_at: string | null; access_hours: number }>();
  if (!pass) return NextResponse.json({ error: "This sponsored pass does not exist." }, { status: 404 });
  if (pass.donor_email === user.email) return NextResponse.json({ error: "Sponsored passes must be given to another learner." }, { status: 409 });
  if (pass.recipient_email === user.email && pass.expires_at && pass.expires_at > new Date().toISOString()) {
    return NextResponse.json({ claimed: true, expiresAt: pass.expires_at });
  }
  if (pass.status !== "available" || pass.recipient_email) return NextResponse.json({ error: "This pass has already been claimed." }, { status: 409 });

  const claimedAt = new Date();
  const expiresAt = new Date(claimedAt.getTime() + pass.access_hours * 60 * 60 * 1000);
  const update = await getD1().prepare(`UPDATE sponsored_access_passes
    SET recipient_email = ?, status = 'claimed', claimed_at = ?, expires_at = ?
    WHERE pass_code = ? AND status = 'available' AND recipient_email IS NULL`)
    .bind(user.email, claimedAt.toISOString(), expiresAt.toISOString(), code).run();
  if (!update.meta.changes) return NextResponse.json({ error: "Someone else just claimed this pass." }, { status: 409 });
  return NextResponse.json({ claimed: true, expiresAt: expiresAt.toISOString() });
}
