import { NextRequest, NextResponse } from "next/server";
import { findValidPromotion } from "../../../../db/billing";
import { getChatGPTUser } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  if (typeof body?.code !== "string" || !body.code.trim()) return NextResponse.json({ error: "Enter a promotion code." }, { status: 400 });
  const promotion = await findValidPromotion(body.code, user.email);
  if (!promotion) return NextResponse.json({ error: "That code is invalid, expired, fully used, or already redeemed." }, { status: 404 });
  return NextResponse.json({ code: promotion.code, percentOff: promotion.percentOff });
}
