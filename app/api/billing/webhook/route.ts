import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { ensureAppSchema, getD1 } from "../../../../db";
import { addBillingNotification, completePromotion, releasePromotion } from "../../../../db/billing";
import { billingPlanLabel } from "../../../../lib/billing-config";
import { getStripe, getStripeWebhookSecret } from "../../../../lib/stripe-server";

export const dynamic = "force-dynamic";

type SubscriptionObject = {
  id: string; customer: string | { id: string }; status: string; cancel_at_period_end?: boolean;
  current_period_start?: number; current_period_end?: number;
  items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
  metadata?: Record<string, string>; pending_update?: unknown;
};
type CheckoutObject = {
  id: string; customer?: string | { id: string } | null; subscription?: string | { id: string } | null;
  payment_intent?: string | { id: string } | null; client_reference_id?: string | null;
  customer_details?: { email?: string | null } | null; metadata?: Record<string, string> | null;
  amount_total?: number | null; currency?: string | null; payment_status?: string;
};
type InvoiceObject = {
  id: string; customer?: string | { id: string } | null; amount_paid?: number; amount_due?: number; currency?: string;
  status?: string | null; created?: number; hosted_invoice_url?: string | null; invoice_pdf?: string | null;
  payment_intent?: string | { id: string } | null; charge?: string | { id: string } | null;
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null; metadata?: Record<string, string> | null } | null } | null;
  last_finalization_error?: { message?: string | null } | null;
};
type ChargeObject = {
  id: string; customer?: string | { id: string } | null; invoice?: string | { id: string } | null;
  payment_intent?: string | { id: string } | null; amount?: number; amount_refunded?: number; refunded?: boolean;
  currency?: string; receipt_url?: string | null; failure_message?: string | null; metadata?: Record<string, string>;
};

const objectId = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id ?? null;
const isoFromUnix = (value: number | undefined) => value ? new Date(value * 1000).toISOString() : null;
const int = (value: string | undefined) => Number.isFinite(Number(value)) ? Number(value) : 0;

async function paymentDetails(stripe: Stripe, paymentIntentId: string | null) {
  if (!paymentIntentId) return { chargeId: null, receiptUrl: null };
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    return { chargeId: objectId(intent.latest_charge), receiptUrl: charge?.receipt_url ?? null };
  } catch {
    return { chargeId: null, receiptUrl: null };
  }
}

async function upsertCheckout(stripe: Stripe, event: Stripe.Event, session: CheckoutObject) {
  const email = session.metadata?.user_email || session.client_reference_id || session.customer_details?.email;
  if (!email || !["paid", "no_payment_required"].includes(session.payment_status ?? "")) return;
  const now = new Date().toISOString();
  await completePromotion(session.id);
  if (session.metadata?.purchase_type === "starter_pass") {
    const accessDays = Math.max(1, Math.min(14, int(session.metadata.access_days) || 7));
    const expiresAt = new Date(Date.now() + accessDays * 24 * 60 * 60 * 1000).toISOString();
    const paymentIntentId = objectId(session.payment_intent);
    const details = await paymentDetails(stripe, paymentIntentId);
    await getD1().prepare(`INSERT INTO paid_access_passes (
      user_email, stripe_checkout_session_id, status, amount_paid, currency, starts_at, expires_at, credit_amount, created_at
    ) VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?) ON CONFLICT(stripe_checkout_session_id) DO NOTHING`)
      .bind(email, session.id, session.amount_total ?? 0, session.currency ?? "kzt", now, expiresAt, session.amount_total ?? 0, now).run();
    await getD1().prepare(`INSERT INTO payment_history (
      user_email, stripe_event_id, stripe_invoice_id, stripe_payment_intent_id, stripe_charge_id, stripe_checkout_session_id,
      amount_paid, refunded_amount, currency, status, plan_interval, discount_percent, promotion_code, receipt_url, paid_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'paid', 'starter_week', ?, ?, ?, ?, ?) ON CONFLICT(stripe_event_id) DO NOTHING`)
      .bind(email, event.id, session.id, paymentIntentId, details.chargeId, session.id, session.amount_total ?? 0, session.currency ?? "kzt",
        int(session.metadata.discount_percent), session.metadata.promotion_code || null, details.receiptUrl, now, now).run();
    return;
  }

  const subscriptionId = objectId(session.subscription);
  let subscription: SubscriptionObject | null = null;
  if (subscriptionId) {
    try { subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as SubscriptionObject; } catch { subscription = null; }
  }
  const period = subscription?.items?.data?.[0];
  await getD1().prepare(`INSERT INTO subscriptions (
    user_email, stripe_customer_id, stripe_subscription_id, plan_interval, status, discount_percent, promotion_code,
    current_period_start, current_period_end, grace_until, last_payment_error, cancel_at_period_end, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)
  ON CONFLICT(user_email) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id, plan_interval = excluded.plan_interval, status = excluded.status,
    discount_percent = excluded.discount_percent, promotion_code = excluded.promotion_code,
    current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
    grace_until = NULL, last_payment_error = NULL, cancel_at_period_end = 0, updated_at = excluded.updated_at`)
    .bind(email, objectId(session.customer), subscriptionId, session.metadata?.plan_interval ?? "gold_month", subscription?.status ?? "active",
      int(session.metadata?.discount_percent), session.metadata?.promotion_code || null,
      isoFromUnix(subscription?.current_period_start ?? period?.current_period_start), isoFromUnix(subscription?.current_period_end ?? period?.current_period_end), now, now).run();
  const creditPassId = int(session.metadata?.starter_credit_pass_id);
  if (creditPassId) await getD1().prepare(`UPDATE paid_access_passes SET credit_used_at = ?, credit_reserved_session_id = NULL
    WHERE id = ? AND user_email = ? AND credit_reserved_session_id = ? AND credit_used_at IS NULL`).bind(now, creditPassId, email, session.id).run();
}

async function releaseCheckout(session: CheckoutObject) {
  await getD1().prepare(`UPDATE paid_access_passes SET credit_reserved_session_id = NULL
    WHERE credit_reserved_session_id = ? AND credit_used_at IS NULL`).bind(session.id).run();
  await releasePromotion(session.id);
}

async function upsertSubscription(event: Stripe.Event, subscription: SubscriptionObject, deleted = false) {
  const subscriptionId = subscription.id;
  const existingById = await getD1().prepare("SELECT user_email, plan_interval, discount_percent, promotion_code FROM subscriptions WHERE stripe_subscription_id = ? LIMIT 1")
    .bind(subscriptionId).first<{ user_email: string; plan_interval: string; discount_percent: number; promotion_code: string | null }>();
  if (deleted && !existingById) return;
  const email = subscription.metadata?.user_email || existingById?.user_email;
  if (!email) return;
  const now = new Date().toISOString();
  const period = subscription.items?.data?.[0];
  const status = deleted ? "canceled" : subscription.status;
  await getD1().prepare(`INSERT INTO subscriptions (
    user_email, stripe_customer_id, stripe_subscription_id, plan_interval, status, discount_percent, promotion_code,
    current_period_start, current_period_end, grace_until, last_payment_error, cancel_at_period_end, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
  ON CONFLICT(user_email) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id, plan_interval = excluded.plan_interval,
    status = excluded.status, discount_percent = excluded.discount_percent, promotion_code = excluded.promotion_code,
    current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end, updated_at = excluded.updated_at`)
    .bind(email, objectId(subscription.customer), subscriptionId, subscription.metadata?.plan_interval ?? existingById?.plan_interval ?? "gold_month",
      status, int(subscription.metadata?.discount_percent) || existingById?.discount_percent || 0,
      subscription.metadata?.promotion_code || existingById?.promotion_code || null,
      isoFromUnix(subscription.current_period_start ?? period?.current_period_start), isoFromUnix(subscription.current_period_end ?? period?.current_period_end),
      subscription.cancel_at_period_end ? 1 : 0, now, now).run();
  if (deleted) await addBillingNotification({ userEmail: email, stripeEventId: event.id, kind: "cancelled", title: "Membership ended", message: "Your paid membership has ended. You can renew at any time from the membership page." });
  else if (subscription.pending_update) await addBillingNotification({ userEmail: email, stripeEventId: event.id, kind: "payment_action", title: "Upgrade payment needs attention", message: "Your plan upgrade is waiting for payment. Update your payment method to complete it." });
}

async function invoiceAccount(invoice: InvoiceObject) {
  const subscriptionId = objectId(invoice.subscription) ?? objectId(invoice.parent?.subscription_details?.subscription);
  const customerId = objectId(invoice.customer);
  const existing = subscriptionId
    ? await getD1().prepare("SELECT user_email, plan_interval, discount_percent, promotion_code FROM subscriptions WHERE stripe_subscription_id = ? LIMIT 1").bind(subscriptionId).first<{ user_email: string; plan_interval: string; discount_percent: number; promotion_code: string | null }>()
    : await getD1().prepare("SELECT user_email, plan_interval, discount_percent, promotion_code FROM subscriptions WHERE stripe_customer_id = ? LIMIT 1").bind(customerId).first<{ user_email: string; plan_interval: string; discount_percent: number; promotion_code: string | null }>();
  return { subscriptionId, existing, email: invoice.parent?.subscription_details?.metadata?.user_email || existing?.user_email };
}

async function saveInvoice(stripe: Stripe, event: Stripe.Event, invoice: InvoiceObject, successful: boolean) {
  const account = await invoiceAccount(invoice);
  if (!account.email) return;
  const paymentIntentId = objectId(invoice.payment_intent);
  const details = await paymentDetails(stripe, paymentIntentId);
  const chargeId = objectId(invoice.charge) ?? details.chargeId;
  const metadata = invoice.parent?.subscription_details?.metadata;
  const now = new Date().toISOString();
  const failureReason = successful ? null : invoice.last_finalization_error?.message || "The saved payment method could not complete this charge.";
  await getD1().prepare(`INSERT INTO payment_history (
    user_email, stripe_event_id, stripe_invoice_id, stripe_payment_intent_id, stripe_charge_id,
    amount_paid, refunded_amount, currency, status, plan_interval, discount_percent, promotion_code,
    receipt_url, invoice_pdf_url, failure_reason, paid_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(stripe_event_id) DO NOTHING`)
    .bind(account.email, event.id, invoice.id, paymentIntentId, chargeId, successful ? invoice.amount_paid ?? 0 : invoice.amount_due ?? 0,
      invoice.currency ?? "kzt", successful ? "paid" : "failed", metadata?.plan_interval ?? account.existing?.plan_interval ?? "gold_month",
      int(metadata?.discount_percent) || account.existing?.discount_percent || 0, metadata?.promotion_code || account.existing?.promotion_code || null,
      details.receiptUrl, invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? null, failureReason,
      isoFromUnix(invoice.created) ?? now, now).run();
  if (account.subscriptionId) {
    if (successful) {
      await getD1().prepare("UPDATE subscriptions SET status = 'active', grace_until = NULL, last_payment_error = NULL, updated_at = ? WHERE stripe_subscription_id = ?")
        .bind(now, account.subscriptionId).run();
      await getD1().prepare("UPDATE billing_notifications SET status = 'resolved' WHERE user_email = ? AND kind IN ('payment_failed', 'payment_action') AND status = 'unread'").bind(account.email).run();
    } else {
      const graceUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await getD1().prepare("UPDATE subscriptions SET status = 'past_due', grace_until = ?, last_payment_error = ?, updated_at = ? WHERE stripe_subscription_id = ?")
        .bind(graceUntil, failureReason, now, account.subscriptionId).run();
      await addBillingNotification({ userEmail: account.email, stripeEventId: event.id, kind: "payment_failed", title: "Payment failed — 3-day grace period", message: "Update your card to keep uninterrupted access. Stripe will retry according to the account recovery settings." });
    }
  }
}

async function saveUpcoming(event: Stripe.Event, invoice: InvoiceObject) {
  const account = await invoiceAccount(invoice);
  if (!account.email) return;
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: (invoice.currency ?? "kzt").toUpperCase(), maximumFractionDigits: 0 }).format((invoice.amount_due ?? 0) / 100);
  await addBillingNotification({ userEmail: account.email, stripeEventId: event.id, kind: "renewal", title: "Membership renewal is approaching", message: `${billingPlanLabel(account.existing?.plan_interval ?? "")} is scheduled to renew for ${amount}. You can review or cancel it from Manage billing.` });
}

async function saveRefund(event: Stripe.Event, charge: ChargeObject) {
  const paymentIntentId = objectId(charge.payment_intent);
  const invoiceId = objectId(charge.invoice);
  const payment = await getD1().prepare(`SELECT id, user_email, plan_interval, amount_paid, stripe_checkout_session_id FROM payment_history
    WHERE stripe_charge_id = ? OR stripe_payment_intent_id = ? OR stripe_invoice_id = ? ORDER BY paid_at DESC LIMIT 1`)
    .bind(charge.id, paymentIntentId, invoiceId).first<{ id: number; user_email: string; plan_interval: string; amount_paid: number; stripe_checkout_session_id: string | null }>();
  if (!payment) return;
  const refundedAmount = Math.max(0, charge.amount_refunded ?? 0);
  const full = Boolean(charge.refunded || refundedAmount >= payment.amount_paid);
  const now = new Date().toISOString();
  await getD1().prepare(`UPDATE payment_history SET stripe_charge_id = COALESCE(stripe_charge_id, ?), receipt_url = COALESCE(receipt_url, ?),
    refunded_amount = ?, status = ?, updated_at = ? WHERE id = ?`).bind(charge.id, charge.receipt_url ?? null, refundedAmount, full ? "refunded" : "partially_refunded", now, payment.id).run();
  if (full && payment.plan_interval === "starter_week" && payment.stripe_checkout_session_id) {
    await getD1().prepare("UPDATE paid_access_passes SET status = 'refunded', expires_at = ? WHERE stripe_checkout_session_id = ?")
      .bind(now, payment.stripe_checkout_session_id).run();
  }
  await addBillingNotification({ userEmail: payment.user_email, stripeEventId: event.id, kind: "refund", title: full ? "Payment refunded" : "Partial refund issued", message: "The refund is recorded in your payment history. Bank processing time depends on the original payment method." });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();
  if (!stripe || !webhookSecret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  const rawBody = await request.text();
  let event: Stripe.Event;
  try { event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret); }
  catch { return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 }); }

  await ensureAppSchema();
  const object = event.data.object as unknown;
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") await upsertCheckout(stripe, event, object as CheckoutObject);
  else if (["checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type)) await releaseCheckout(object as CheckoutObject);
  else if (event.type === "customer.subscription.updated") await upsertSubscription(event, object as SubscriptionObject);
  else if (event.type === "customer.subscription.deleted") await upsertSubscription(event, object as SubscriptionObject, true);
  else if (event.type === "invoice.paid") await saveInvoice(stripe, event, object as InvoiceObject, true);
  else if (event.type === "invoice.payment_failed") await saveInvoice(stripe, event, object as InvoiceObject, false);
  else if (event.type === "invoice.upcoming") await saveUpcoming(event, object as InvoiceObject);
  else if (event.type === "invoice.payment_action_required") {
    const account = await invoiceAccount(object as InvoiceObject);
    if (account.email) await addBillingNotification({ userEmail: account.email, stripeEventId: event.id, kind: "payment_action", title: "Payment authentication required", message: "Open Manage billing and confirm the payment to keep your membership active." });
  }
  else if (event.type === "charge.refunded") await saveRefund(event, object as ChargeObject);
  return NextResponse.json({ received: true });
}
