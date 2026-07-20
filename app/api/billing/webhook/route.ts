import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { ensureAppSchema, getD1 } from "../../../../db";
import { getStripe, getStripeWebhookSecret } from "../../../../lib/stripe-server";

export const dynamic = "force-dynamic";

type SubscriptionObject = {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  items?: { data?: Array<{ current_period_end?: number }> };
  metadata?: Record<string, string>;
};

type CheckoutObject = {
  id: string;
  customer?: string | { id: string } | null;
  subscription?: string | { id: string } | null;
  client_reference_id?: string | null;
  customer_details?: { email?: string | null } | null;
  metadata?: Record<string, string> | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_status?: string;
};

type InvoiceObject = {
  id: string;
  customer?: string | { id: string } | null;
  amount_paid?: number;
  amount_due?: number;
  currency?: string;
  status?: string | null;
  created?: number;
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null; metadata?: Record<string, string> | null } | null } | null;
};

const objectId = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id ?? null;
const isoFromUnix = (value: number | undefined) => value ? new Date(value * 1000).toISOString() : null;
const int = (value: string | undefined) => Number.isFinite(Number(value)) ? Number(value) : 0;

async function upsertCheckout(event: Stripe.Event, session: CheckoutObject) {
  const email = session.metadata?.user_email || session.client_reference_id || session.customer_details?.email;
  if (!email) return;
  const now = new Date().toISOString();
  if (session.metadata?.purchase_type === "starter_pass") {
    if (session.payment_status !== "paid") return;
    const accessDays = Math.max(1, Math.min(14, int(session.metadata.access_days) || 7));
    const expiresAt = new Date(Date.now() + accessDays * 24 * 60 * 60 * 1000).toISOString();
    await getD1().prepare(`INSERT INTO paid_access_passes (
      user_email, stripe_checkout_session_id, status, amount_paid, currency, starts_at, expires_at, credit_amount, created_at
    ) VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?) ON CONFLICT(stripe_checkout_session_id) DO NOTHING`)
      .bind(email, session.id, session.amount_total ?? 0, session.currency ?? "kzt", now, expiresAt, int(session.metadata.base_amount) || 1_000_000, now).run();
    await getD1().prepare(`INSERT INTO payment_history (
      user_email, stripe_event_id, stripe_invoice_id, amount_paid, currency, status, plan_interval, discount_percent, paid_at
    ) VALUES (?, ?, ?, ?, ?, 'paid', 'starter_week', 0, ?) ON CONFLICT(stripe_event_id) DO NOTHING`)
      .bind(email, event.id, session.id, session.amount_total ?? 0, session.currency ?? "kzt", now).run();
    return;
  }
  await getD1().prepare(`INSERT INTO subscriptions (
    user_email, stripe_customer_id, stripe_subscription_id, plan_interval, status, discount_percent, current_period_end, cancel_at_period_end, created_at, updated_at
  ) VALUES (?, ?, ?, ?, 'active', ?, NULL, 0, ?, ?)
  ON CONFLICT(user_email) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id, plan_interval = excluded.plan_interval,
    status = excluded.status, discount_percent = excluded.discount_percent, updated_at = excluded.updated_at`)
    .bind(email, objectId(session.customer), objectId(session.subscription), session.metadata?.plan_interval ?? "gold_month", int(session.metadata?.discount_percent), now, now).run();
  const creditPassId = int(session.metadata?.starter_credit_pass_id);
  if (creditPassId) {
    await getD1().prepare(`UPDATE paid_access_passes SET credit_used_at = ?, credit_reserved_session_id = NULL
      WHERE id = ? AND user_email = ? AND credit_reserved_session_id = ? AND credit_used_at IS NULL`)
      .bind(now, creditPassId, email, session.id).run();
  }
}

async function releaseStarterCredit(session: CheckoutObject) {
  await getD1().prepare(`UPDATE paid_access_passes SET credit_reserved_session_id = NULL
    WHERE credit_reserved_session_id = ? AND credit_used_at IS NULL`).bind(session.id).run();
}

async function upsertSubscription(subscription: SubscriptionObject, deleted = false) {
  const subscriptionId = subscription.id;
  const customerId = objectId(subscription.customer);
  const emailFromMetadata = subscription.metadata?.user_email;
  const existing = await getD1().prepare("SELECT user_email, plan_interval, discount_percent FROM subscriptions WHERE stripe_subscription_id = ? OR stripe_customer_id = ? LIMIT 1")
    .bind(subscriptionId, customerId).first<{ user_email: string; plan_interval: string; discount_percent: number }>();
  const email = emailFromMetadata || existing?.user_email;
  if (!email) return;
  const now = new Date().toISOString();
  const period = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
  await getD1().prepare(`INSERT INTO subscriptions (
    user_email, stripe_customer_id, stripe_subscription_id, plan_interval, status, discount_percent, current_period_end, cancel_at_period_end, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_email) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id, plan_interval = excluded.plan_interval,
    status = excluded.status, discount_percent = excluded.discount_percent, current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end, updated_at = excluded.updated_at`)
    .bind(
      email,
      customerId,
      subscriptionId,
      subscription.metadata?.plan_interval ?? existing?.plan_interval ?? "gold_month",
      deleted ? "canceled" : subscription.status,
      int(subscription.metadata?.discount_percent) || existing?.discount_percent || 0,
      isoFromUnix(period),
      subscription.cancel_at_period_end ? 1 : 0,
      now,
      now,
    ).run();
}

async function saveInvoice(event: Stripe.Event, invoice: InvoiceObject, successful: boolean) {
  const subscriptionId = objectId(invoice.subscription) ?? objectId(invoice.parent?.subscription_details?.subscription);
  const customerId = objectId(invoice.customer);
  const existing = await getD1().prepare("SELECT user_email, plan_interval, discount_percent FROM subscriptions WHERE stripe_subscription_id = ? OR stripe_customer_id = ? LIMIT 1")
    .bind(subscriptionId, customerId).first<{ user_email: string; plan_interval: string; discount_percent: number }>();
  const email = invoice.parent?.subscription_details?.metadata?.user_email || existing?.user_email;
  if (!email) return;
  await getD1().prepare(`INSERT INTO payment_history (
    user_email, stripe_event_id, stripe_invoice_id, amount_paid, currency, status, plan_interval, discount_percent, paid_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(stripe_event_id) DO NOTHING`)
    .bind(
      email,
      event.id,
      invoice.id,
      successful ? invoice.amount_paid ?? 0 : invoice.amount_due ?? 0,
      invoice.currency ?? "kzt",
      successful ? "paid" : "failed",
      existing?.plan_interval ?? invoice.parent?.subscription_details?.metadata?.plan_interval ?? "gold_month",
      existing?.discount_percent ?? int(invoice.parent?.subscription_details?.metadata?.discount_percent),
      isoFromUnix(invoice.created) ?? new Date().toISOString(),
    ).run();
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();
  if (!stripe || !webhookSecret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }
  await ensureAppSchema();
  const object = event.data.object as unknown;
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") await upsertCheckout(event, object as CheckoutObject);
  else if (event.type === "checkout.session.expired") await releaseStarterCredit(object as CheckoutObject);
  else if (event.type === "customer.subscription.updated") await upsertSubscription(object as SubscriptionObject);
  else if (event.type === "customer.subscription.deleted") await upsertSubscription(object as SubscriptionObject, true);
  else if (event.type === "invoice.paid") await saveInvoice(event, object as InvoiceObject, true);
  else if (event.type === "invoice.payment_failed") await saveInvoice(event, object as InvoiceObject, false);
  return NextResponse.json({ received: true });
}
