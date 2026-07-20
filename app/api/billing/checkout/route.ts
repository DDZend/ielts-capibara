import { NextRequest, NextResponse } from "next/server";
import { ensureAppSchema, getBillingSummary, getD1 } from "../../../../db";
import { findValidPromotion, reservePromotion } from "../../../../db/billing";
import { BILLING_CURRENCY, BILLING_PLANS, discountedAmount, isBillingPlanId, isMembershipUpgrade } from "../../../../lib/billing-config";
import { getStripe, stripeCheckoutConfigured } from "../../../../lib/stripe-server";
import { getChatGPTUser } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

const isoFromUnix = (value: number | undefined) => value ? new Date(value * 1000).toISOString() : null;

export async function POST(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const values = body && typeof body === "object" ? body as { plan?: unknown; promoCode?: unknown } : {};
  const planId = values.plan;
  if (!isBillingPlanId(planId)) return NextResponse.json({ error: "Choose a valid membership option." }, { status: 400 });

  const stripe = getStripe();
  if (!stripe || !stripeCheckoutConfigured()) return NextResponse.json({ error: "Secure checkout is being connected. No payment has been taken." }, { status: 503 });

  await ensureAppSchema();
  const summary = await getBillingSummary(user.email);
  const subscriptionRow = await getD1().prepare(`SELECT stripe_subscription_id, plan_interval, status FROM subscriptions WHERE user_email = ? LIMIT 1`)
    .bind(user.email).first<{ stripe_subscription_id: string | null; plan_interval: string; status: string }>();
  const activeSubscription = Boolean(subscriptionRow?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(subscriptionRow.status));
  const plan = BILLING_PLANS[planId];

  if (activeSubscription) {
    if (plan.kind !== "subscription" || !isMembershipUpgrade(subscriptionRow!.plan_interval, planId)) {
      return NextResponse.json({ error: "Your current membership can be renewed or cancelled from Manage billing. Only upgrades to a higher support tier are available here." }, { status: 409 });
    }
    if (typeof values.promoCode === "string" && values.promoCode.trim()) {
      return NextResponse.json({ error: "Promotion codes apply to a new membership. Your Capi-Coin discount and the unused value of your current plan are both applied automatically to this upgrade." }, { status: 400 });
    }
    const existing = await stripe.subscriptions.retrieve(subscriptionRow!.stripe_subscription_id!, { expand: ["latest_invoice"] });
    const item = existing.items.data[0];
    if (!item) return NextResponse.json({ error: "The current Stripe membership has no billable item. Please contact support." }, { status: 409 });
    const unitAmount = discountedAmount(plan.amount, summary.discountPercent);
    const price = await stripe.prices.create({
      currency: BILLING_CURRENCY,
      unit_amount: unitAmount,
      recurring: { interval: plan.interval, interval_count: plan.intervalCount },
      product_data: { name: `IELTS Mastery ${plan.label}` },
      metadata: { plan_interval: planId, capi_discount_percent: String(summary.discountPercent) },
    });
    const updated = await stripe.subscriptions.update(existing.id, {
      items: [{ id: item.id, price: price.id }],
      proration_behavior: "always_invoice",
      payment_behavior: "pending_if_incomplete",
      cancel_at_period_end: false,
      metadata: { ...existing.metadata, user_email: user.email, plan_interval: planId, discount_percent: String(summary.discountPercent), purchase_type: "membership_upgrade" },
      expand: ["latest_invoice"],
    });
    const result = updated as unknown as {
      status: string;
      pending_update?: unknown;
      latest_invoice?: string | { hosted_invoice_url?: string | null } | null;
      items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
    };
    const invoiceUrl = typeof result.latest_invoice === "object" ? result.latest_invoice?.hosted_invoice_url : null;
    if (result.pending_update) {
      return invoiceUrl
        ? NextResponse.json({ url: invoiceUrl, pending: true })
        : NextResponse.json({ error: "Stripe needs a new payment method before the upgrade can finish. Open Manage billing and update the card, then try again." }, { status: 402 });
    }
    const period = result.items?.data?.[0];
    await getD1().prepare(`UPDATE subscriptions SET plan_interval = ?, status = ?, discount_percent = ?, promotion_code = NULL,
      current_period_start = ?, current_period_end = ?, cancel_at_period_end = 0, grace_until = NULL, last_payment_error = NULL, updated_at = ?
      WHERE user_email = ? AND stripe_subscription_id = ?`).bind(
      planId, result.status, summary.discountPercent, isoFromUnix(period?.current_period_start), isoFromUnix(period?.current_period_end),
      new Date().toISOString(), user.email, existing.id,
    ).run();
    return NextResponse.json({ updated: true });
  }

  const requestedPromo = typeof values.promoCode === "string" ? values.promoCode : "";
  const promotion = requestedPromo.trim() ? await findValidPromotion(requestedPromo, user.email) : null;
  if (requestedPromo.trim() && !promotion) return NextResponse.json({ error: "That promotion code is invalid, expired, fully used, or already redeemed by this account." }, { status: 400 });

  const origin = request.nextUrl.origin;
  const unitAmount = discountedAmount(plan.amount, summary.discountPercent);
  const promoAmount = promotion ? Math.round(unitAmount * promotion.percentOff / 100) : 0;

  if (plan.kind === "one_time") {
    if (summary.hasStarterPurchase) return NextResponse.json({ error: "The Starter Pass is available once per student. Choose Silver, Gold, or Platinum to continue." }, { status: 409 });
    let couponId: string | undefined;
    if (promoAmount > 0) {
      const coupon = await stripe.coupons.create({ amount_off: Math.min(unitAmount - 1, promoAmount), currency: BILLING_CURRENCY, duration: "once", max_redemptions: 1, name: `${promotion!.code} promotion` });
      couponId = coupon.id;
    }
    const metadata = {
      user_email: user.email, plan_interval: planId, purchase_type: "starter_pass", access_days: String(plan.accessDays),
      discount_percent: String(summary.discountPercent), promotion_code: promotion?.code ?? "", promotion_percent: String(promotion?.percentOff ?? 0), base_amount: String(plan.amount),
    };
    const session = await stripe.checkout.sessions.create({
      mode: "payment", customer_email: user.email, client_reference_id: user.email,
      line_items: [{ quantity: 1, price_data: { currency: BILLING_CURRENCY, unit_amount: unitAmount, product_data: { name: `IELTS Mastery ${plan.label}`, description: plan.description } } }],
      discounts: couponId ? [{ coupon: couponId }] : undefined,
      metadata, billing_address_collection: "auto",
      payment_intent_data: { metadata },
      success_url: `${origin}/billing?checkout=success`, cancel_url: `${origin}/billing?checkout=cancelled`,
    });
    if (promotion && !(await reservePromotion(promotion, user.email, session.id))) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      return NextResponse.json({ error: "That promotion code was just claimed by another checkout. Please choose another offer." }, { status: 409 });
    }
    if (!session.url) return NextResponse.json({ error: "Stripe did not return a checkout address." }, { status: 502 });
    return NextResponse.json({ url: session.url });
  }

  const starterCredit = summary.starterCredit?.amount ?? 0;
  const totalFirstPaymentCredit = Math.min(unitAmount - 1, promoAmount + starterCredit);
  let couponId: string | undefined;
  if (totalFirstPaymentCredit > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: totalFirstPaymentCredit, currency: BILLING_CURRENCY, duration: "once", max_redemptions: 1,
      name: [promotion?.code, starterCredit ? "Starter Pass upgrade credit" : ""].filter(Boolean).join(" + "),
      metadata: { user_email: user.email, paid_access_pass_id: summary.starterCredit ? String(summary.starterCredit.passId) : "", promotion_code: promotion?.code ?? "" },
    });
    couponId = coupon.id;
  }
  const metadata = {
    user_email: user.email, plan_interval: planId, purchase_type: "subscription", discount_percent: String(summary.discountPercent),
    promotion_code: promotion?.code ?? "", promotion_percent: String(promotion?.percentOff ?? 0), base_amount: String(plan.amount),
    starter_credit_pass_id: summary.starterCredit ? String(summary.starterCredit.passId) : "",
  };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription", customer_email: user.email, client_reference_id: user.email,
    line_items: [{ quantity: 1, price_data: { currency: BILLING_CURRENCY, unit_amount: unitAmount, recurring: { interval: plan.interval, interval_count: plan.intervalCount }, product_data: { name: `IELTS Mastery ${plan.label}`, description: plan.description } } }],
    subscription_data: { metadata }, metadata, discounts: couponId ? [{ coupon: couponId }] : undefined,
    billing_address_collection: "auto", allow_promotion_codes: false,
    success_url: `${origin}/billing?checkout=success`, cancel_url: `${origin}/billing?checkout=cancelled`,
  });

  if (summary.starterCredit) {
    const reserved = await getD1().prepare(`UPDATE paid_access_passes SET credit_reserved_session_id = ?
      WHERE id = ? AND user_email = ? AND credit_used_at IS NULL AND credit_reserved_session_id IS NULL`)
      .bind(session.id, summary.starterCredit.passId, user.email).run();
    if (!reserved.meta.changes) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      return NextResponse.json({ error: "Your Starter credit is being used by another checkout. Refresh and try again." }, { status: 409 });
    }
  }
  if (promotion && !(await reservePromotion(promotion, user.email, session.id))) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    if (summary.starterCredit) await getD1().prepare("UPDATE paid_access_passes SET credit_reserved_session_id = NULL WHERE credit_reserved_session_id = ?").bind(session.id).run();
    return NextResponse.json({ error: "That promotion code was just claimed by another checkout. Please choose another offer." }, { status: 409 });
  }
  if (!session.url) return NextResponse.json({ error: "Stripe did not return a checkout address." }, { status: 502 });
  return NextResponse.json({ url: session.url });
}
