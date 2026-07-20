import { NextRequest, NextResponse } from "next/server";
import { getBillingSummary } from "../../../../db";
import { BILLING_CURRENCY, BILLING_PLANS, discountedAmount, isBillingPlanId } from "../../../../lib/billing-config";
import { getStripe, stripeCheckoutConfigured } from "../../../../lib/stripe-server";
import { getChatGPTUser } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const planId = body && typeof body === "object" ? (body as { plan?: unknown }).plan : null;
  if (!isBillingPlanId(planId)) return NextResponse.json({ error: "Choose a valid subscription plan." }, { status: 400 });

  const stripe = getStripe();
  if (!stripe || !stripeCheckoutConfigured()) return NextResponse.json({ error: "Secure checkout is being connected. No payment has been taken." }, { status: 503 });

  const summary = await getBillingSummary(user.email);
  if (summary.subscription && ["active", "trialing"].includes(summary.subscription.status)) {
    return NextResponse.json({ error: "You already have an active subscription. Manage it from your billing page." }, { status: 409 });
  }

  const plan = BILLING_PLANS[planId];
  const unitAmount = discountedAmount(plan.amount, summary.discountPercent);
  const metadata = {
    user_email: user.email,
    plan_interval: planId,
    discount_percent: String(summary.discountPercent),
    base_amount: String(plan.amount),
  };
  const origin = request.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    client_reference_id: user.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: BILLING_CURRENCY,
        unit_amount: unitAmount,
        recurring: { interval: plan.interval, interval_count: plan.intervalCount },
        product_data: { name: `IELTS Mastery ${plan.label}`, description: plan.description },
      },
    }],
    subscription_data: { metadata },
    metadata,
    billing_address_collection: "auto",
    allow_promotion_codes: false,
    success_url: `${origin}/billing?checkout=success`,
    cancel_url: `${origin}/billing?checkout=cancelled`,
  });

  if (!session.url) return NextResponse.json({ error: "Stripe did not return a checkout address." }, { status: 502 });
  return NextResponse.json({ url: session.url });
}
