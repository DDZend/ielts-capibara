import { NextRequest, NextResponse } from "next/server";
import { ensureAppSchema, getBillingSummary, getD1 } from "../../../../db";
import { BILLING_CURRENCY, BILLING_PLANS, discountedAmount, isBillingPlanId } from "../../../../lib/billing-config";
import { getStripe, stripeCheckoutConfigured } from "../../../../lib/stripe-server";
import { getChatGPTUser } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const planId = body && typeof body === "object" ? (body as { plan?: unknown }).plan : null;
  if (!isBillingPlanId(planId)) return NextResponse.json({ error: "Choose a valid membership option." }, { status: 400 });

  const stripe = getStripe();
  if (!stripe || !stripeCheckoutConfigured()) return NextResponse.json({ error: "Secure checkout is being connected. No payment has been taken." }, { status: 503 });

  const summary = await getBillingSummary(user.email);
  if (summary.subscription && ["active", "trialing"].includes(summary.subscription.status)) {
    return NextResponse.json({ error: "You already have an active subscription. Manage it from your billing page." }, { status: 409 });
  }

  const plan = BILLING_PLANS[planId];
  const origin = request.nextUrl.origin;
  if (plan.kind === "one_time") {
    if (summary.hasStarterPurchase) return NextResponse.json({ error: "The Starter Pass is available once per student. Choose Silver, Gold, or Platinum to continue." }, { status: 409 });
    const metadata = {
      user_email: user.email,
      plan_interval: planId,
      purchase_type: "starter_pass",
      access_days: String(plan.accessDays),
      discount_percent: "0",
      base_amount: String(plan.amount),
    };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      client_reference_id: user.email,
      line_items: [{ quantity: 1, price_data: {
        currency: BILLING_CURRENCY,
        unit_amount: plan.amount,
        product_data: { name: `IELTS Mastery ${plan.label}`, description: plan.description },
      } }],
      metadata,
      billing_address_collection: "auto",
      success_url: `${origin}/billing?checkout=success`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
    });
    if (!session.url) return NextResponse.json({ error: "Stripe did not return a checkout address." }, { status: 502 });
    return NextResponse.json({ url: session.url });
  }

  const unitAmount = discountedAmount(plan.amount, summary.discountPercent);
  let couponId: string | undefined;
  if (summary.starterCredit) {
    const coupon = await stripe.coupons.create({
      amount_off: summary.starterCredit.amount,
      currency: BILLING_CURRENCY,
      duration: "once",
      max_redemptions: 1,
      name: "Starter Pass upgrade credit",
      metadata: { user_email: user.email, paid_access_pass_id: String(summary.starterCredit.passId) },
    });
    couponId = coupon.id;
  }
  const metadata = {
    user_email: user.email,
    plan_interval: planId,
    purchase_type: "subscription",
    discount_percent: String(summary.discountPercent),
    base_amount: String(plan.amount),
    starter_credit_pass_id: summary.starterCredit ? String(summary.starterCredit.passId) : "",
  };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    client_reference_id: user.email,
    line_items: [{ quantity: 1, price_data: {
      currency: BILLING_CURRENCY,
      unit_amount: unitAmount,
      recurring: { interval: plan.interval, interval_count: plan.intervalCount },
      product_data: { name: `IELTS Mastery ${plan.label}`, description: plan.description },
    } }],
    subscription_data: { metadata },
    metadata,
    discounts: couponId ? [{ coupon: couponId }] : undefined,
    billing_address_collection: "auto",
    allow_promotion_codes: false,
    success_url: `${origin}/billing?checkout=success`,
    cancel_url: `${origin}/billing?checkout=cancelled`,
  });

  if (summary.starterCredit) {
    await ensureAppSchema();
    const reserved = await getD1().prepare(`UPDATE paid_access_passes SET credit_reserved_session_id = ?
      WHERE id = ? AND user_email = ? AND credit_used_at IS NULL AND credit_reserved_session_id IS NULL`)
      .bind(session.id, summary.starterCredit.passId, user.email).run();
    if (!reserved.meta.changes) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      return NextResponse.json({ error: "Your Starter credit is being used by another checkout. Refresh and try again." }, { status: 409 });
    }
  }
  if (!session.url) return NextResponse.json({ error: "Stripe did not return a checkout address." }, { status: 502 });
  return NextResponse.json({ url: session.url });
}
