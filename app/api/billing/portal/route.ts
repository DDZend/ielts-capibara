import { NextRequest, NextResponse } from "next/server";
import { ensureAppSchema, getD1 } from "../../../../db";
import { getStripe } from "../../../../lib/stripe-server";
import { getChatGPTUser } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Subscription management is not configured yet." }, { status: 503 });
  await ensureAppSchema();
  const row = await getD1().prepare("SELECT stripe_customer_id FROM subscriptions WHERE user_email = ? LIMIT 1")
    .bind(user.email).first<{ stripe_customer_id: string | null }>();
  if (!row?.stripe_customer_id) return NextResponse.json({ error: "No Stripe subscription is linked to this account." }, { status: 404 });
  const portal = await stripe.billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    return_url: `${request.nextUrl.origin}/billing`,
  });
  return NextResponse.json({ url: portal.url });
}
