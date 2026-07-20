import { NextRequest, NextResponse } from "next/server";
import { ensureAppSchema, getD1 } from "../../../../db";
import { getMembershipAdminSnapshot, normalizeCode } from "../../../../db/billing";
import { BILLING_PLANS, isBillingPlanId } from "../../../../lib/billing-config";
import { getStripe } from "../../../../lib/stripe-server";
import { getApiCreatorUser } from "../../../creator-auth";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const finiteInt = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

export async function GET() {
  const auth = await getApiCreatorUser("memberships");
  if (!auth.user) return NextResponse.json({ error: auth.status === 401 ? "Authentication required" : "Teacher access required" }, { status: auth.status });
  return NextResponse.json({ snapshot: await getMembershipAdminSnapshot() });
}

export async function POST(request: NextRequest) {
  const auth = await getApiCreatorUser("memberships");
  if (!auth.user) return NextResponse.json({ error: auth.status === 401 ? "Authentication required" : "Teacher access required" }, { status: auth.status });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  await ensureAppSchema();
  const now = new Date().toISOString();

  if (action === "manual_grant") {
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const planId = body?.plan;
    const days = Math.max(1, Math.min(365, finiteInt(body?.days, 30)));
    if (!emailPattern.test(email)) return NextResponse.json({ error: "Enter a valid student email." }, { status: 400 });
    if (!isBillingPlanId(planId) || BILLING_PLANS[planId].kind !== "subscription") return NextResponse.json({ error: "Choose a Silver, Gold, or Platinum access level." }, { status: 400 });
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) || null : null;
    await getD1().prepare(`INSERT INTO manual_access_grants (user_email, plan_interval, status, starts_at, expires_at, note, granted_by, created_at)
      VALUES (?, ?, 'active', ?, ?, ?, ?, ?)`).bind(email, planId, now, expiresAt, note, auth.user.email, now).run();
  } else if (action === "revoke_grant") {
    const id = finiteInt(body?.id);
    if (!id) return NextResponse.json({ error: "Choose a manual grant." }, { status: 400 });
    await getD1().prepare("UPDATE manual_access_grants SET status = 'revoked', revoked_at = ? WHERE id = ? AND status = 'active'").bind(now, id).run();
  } else if (action === "create_promo") {
    const code = normalizeCode(typeof body?.code === "string" ? body.code : "");
    const percent = Math.max(1, Math.min(50, finiteInt(body?.percent)));
    const maxRedemptions = Math.max(0, Math.min(10000, finiteInt(body?.maxRedemptions)));
    const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
    if (code.length < 3) return NextResponse.json({ error: "Promotion codes need at least three letters or numbers." }, { status: 400 });
    if (expiresAt && expiresAt <= now) return NextResponse.json({ error: "Choose a future expiry date." }, { status: 400 });
    try {
      await getD1().prepare(`INSERT INTO promotion_codes (code, percent_off, max_redemptions, redemption_count, reserved_count, expires_at, active, created_by, created_at)
        VALUES (?, ?, ?, 0, 0, ?, 1, ?, ?)`).bind(code, percent, maxRedemptions || null, expiresAt, auth.user.email, now).run();
    } catch {
      return NextResponse.json({ error: "That promotion code already exists." }, { status: 409 });
    }
  } else if (action === "toggle_promo") {
    const id = finiteInt(body?.id);
    const active = body?.active === true ? 1 : 0;
    if (!id) return NextResponse.json({ error: "Choose a promotion code." }, { status: 400 });
    await getD1().prepare("UPDATE promotion_codes SET active = ? WHERE id = ?").bind(active, id).run();
  } else if (action === "cancel_membership") {
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const timing = body?.timing === "immediate" ? "immediate" : "period_end";
    const row = await getD1().prepare("SELECT stripe_subscription_id FROM subscriptions WHERE user_email = ? LIMIT 1").bind(email).first<{ stripe_subscription_id: string | null }>();
    if (!row?.stripe_subscription_id) return NextResponse.json({ error: "This student has no Stripe subscription." }, { status: 404 });
    const stripe = getStripe();
    if (!stripe) return NextResponse.json({ error: "Stripe is not connected." }, { status: 503 });
    if (timing === "immediate") {
      await stripe.subscriptions.cancel(row.stripe_subscription_id, { prorate: false });
      await getD1().prepare("UPDATE subscriptions SET status = 'canceled', cancel_at_period_end = 0, current_period_end = ?, updated_at = ? WHERE user_email = ?").bind(now, now, email).run();
    } else {
      await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: true });
      await getD1().prepare("UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE user_email = ?").bind(now, email).run();
    }
  } else if (action === "refund_payment") {
    const paymentId = finiteInt(body?.id);
    const revokeAccess = body?.revokeAccess === true;
    const payment = await getD1().prepare(`SELECT id, user_email, status, plan_interval, stripe_charge_id, stripe_payment_intent_id, stripe_checkout_session_id
      FROM payment_history WHERE id = ? LIMIT 1`).bind(paymentId).first<{ id: number; user_email: string; status: string; plan_interval: string; stripe_charge_id: string | null; stripe_payment_intent_id: string | null; stripe_checkout_session_id: string | null }>();
    if (!payment || !["paid", "partially_refunded"].includes(payment.status)) return NextResponse.json({ error: "Choose a refundable payment." }, { status: 404 });
    if (!payment.stripe_charge_id && !payment.stripe_payment_intent_id) return NextResponse.json({ error: "Stripe has not attached a refundable payment reference yet." }, { status: 409 });
    const stripe = getStripe();
    if (!stripe) return NextResponse.json({ error: "Stripe is not connected." }, { status: 503 });
    await stripe.refunds.create({
      ...(payment.stripe_charge_id ? { charge: payment.stripe_charge_id } : { payment_intent: payment.stripe_payment_intent_id! }),
      reason: "requested_by_customer",
      metadata: { teacher_email: auth.user.email, student_email: payment.user_email, payment_history_id: String(payment.id) },
    }, { idempotencyKey: `teacher-full-refund-${payment.id}` });
    if (revokeAccess) {
      if (payment.plan_interval === "starter_week" && payment.stripe_checkout_session_id) {
        await getD1().prepare("UPDATE paid_access_passes SET status = 'refunded', expires_at = ? WHERE stripe_checkout_session_id = ?").bind(now, payment.stripe_checkout_session_id).run();
      } else {
        const sub = await getD1().prepare("SELECT stripe_subscription_id FROM subscriptions WHERE user_email = ? LIMIT 1").bind(payment.user_email).first<{ stripe_subscription_id: string | null }>();
        if (sub?.stripe_subscription_id) await stripe.subscriptions.cancel(sub.stripe_subscription_id, { prorate: false });
        await getD1().prepare("UPDATE subscriptions SET status = 'canceled', current_period_end = ?, updated_at = ? WHERE user_email = ?").bind(now, now, payment.user_email).run();
      }
    }
  } else {
    return NextResponse.json({ error: "Unsupported membership action." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, snapshot: await getMembershipAdminSnapshot() });
}
