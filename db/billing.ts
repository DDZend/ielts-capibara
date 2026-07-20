import { ensureAppSchema, getD1 } from ".";

export type ValidPromotion = { id: number; code: string; percentOff: number };

const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);

export async function findValidPromotion(value: string, userEmail: string): Promise<ValidPromotion | null> {
  await ensureAppSchema();
  const code = normalizeCode(value);
  if (!code) return null;
  const now = new Date().toISOString();
  const row = await getD1().prepare(`SELECT id, code, percent_off FROM promotion_codes
    WHERE code = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?)
      AND (max_redemptions IS NULL OR redemption_count + reserved_count < max_redemptions)
      AND NOT EXISTS (SELECT 1 FROM promotion_redemptions WHERE promotion_code_id = promotion_codes.id AND user_email = ? AND status IN ('reserved', 'redeemed'))
    LIMIT 1`).bind(code, now, userEmail).first<{ id: number; code: string; percent_off: number }>();
  return row ? { id: row.id, code: row.code, percentOff: row.percent_off } : null;
}

export async function reservePromotion(promotion: ValidPromotion, userEmail: string, checkoutSessionId: string) {
  const now = new Date().toISOString();
  try {
    await getD1().prepare(`INSERT INTO promotion_redemptions (promotion_code_id, user_email, stripe_checkout_session_id, status, created_at)
      VALUES (?, ?, ?, 'reserved', ?)`).bind(promotion.id, userEmail, checkoutSessionId, now).run();
  } catch {
    return false;
  }
  const reserved = await getD1().prepare(`UPDATE promotion_codes SET reserved_count = reserved_count + 1
    WHERE id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?)
      AND (max_redemptions IS NULL OR redemption_count + reserved_count < max_redemptions)`)
    .bind(promotion.id, now).run();
  if (!reserved.meta.changes) {
    await getD1().prepare("DELETE FROM promotion_redemptions WHERE stripe_checkout_session_id = ? AND status = 'reserved'").bind(checkoutSessionId).run();
    return false;
  }
  return true;
}

export async function completePromotion(checkoutSessionId: string) {
  const row = await getD1().prepare(`SELECT id, promotion_code_id FROM promotion_redemptions
    WHERE stripe_checkout_session_id = ? AND status = 'reserved' LIMIT 1`).bind(checkoutSessionId).first<{ id: number; promotion_code_id: number }>();
  if (!row) return;
  const now = new Date().toISOString();
  await getD1().batch([
    getD1().prepare("UPDATE promotion_redemptions SET status = 'redeemed', redeemed_at = ? WHERE id = ? AND status = 'reserved'").bind(now, row.id),
    getD1().prepare("UPDATE promotion_codes SET reserved_count = MAX(0, reserved_count - 1), redemption_count = redemption_count + 1 WHERE id = ?").bind(row.promotion_code_id),
  ]);
}

export async function releasePromotion(checkoutSessionId: string) {
  const row = await getD1().prepare(`SELECT id, promotion_code_id FROM promotion_redemptions
    WHERE stripe_checkout_session_id = ? AND status = 'reserved' LIMIT 1`).bind(checkoutSessionId).first<{ id: number; promotion_code_id: number }>();
  if (!row) return;
  await getD1().batch([
    getD1().prepare("DELETE FROM promotion_redemptions WHERE id = ? AND status = 'reserved'").bind(row.id),
    getD1().prepare("UPDATE promotion_codes SET reserved_count = MAX(0, reserved_count - 1) WHERE id = ?").bind(row.promotion_code_id),
  ]);
}

export async function addBillingNotification(input: {
  userEmail: string;
  stripeEventId?: string | null;
  kind: string;
  title: string;
  message: string;
  actionUrl?: string | null;
}) {
  const now = new Date().toISOString();
  await getD1().prepare(`INSERT INTO billing_notifications
    (user_email, stripe_event_id, kind, title, message, action_url, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'unread', ?) ON CONFLICT(stripe_event_id) DO NOTHING`)
    .bind(input.userEmail, input.stripeEventId ?? null, input.kind, input.title, input.message, input.actionUrl ?? "/billing", now).run();
}

export type MembershipAdminSnapshot = {
  students: Array<{
    email: string;
    planInterval: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    lastPaymentError: string | null;
    manualExpiresAt: string | null;
    totalPaid: number;
  }>;
  grants: Array<{ id: number; userEmail: string; planInterval: string; status: string; expiresAt: string; note: string | null; grantedBy: string; createdAt: string }>;
  promotions: Array<{ id: number; code: string; percentOff: number; maxRedemptions: number | null; redemptionCount: number; reservedCount: number; expiresAt: string | null; active: boolean }>;
  payments: Array<{ id: number; userEmail: string; amountPaid: number; refundedAmount: number; currency: string; status: string; planInterval: string; paidAt: string; receiptUrl: string | null }>;
};

export async function getMembershipAdminSnapshot(): Promise<MembershipAdminSnapshot> {
  await ensureAppSchema();
  const [students, grants, promotions, payments] = await Promise.all([
    getD1().prepare(`WITH student_emails AS (
      SELECT user_email FROM assessment_results UNION SELECT user_email FROM study_tasks
      UNION SELECT user_email FROM ai_practice_assessments UNION SELECT user_email FROM subscriptions
      UNION SELECT user_email FROM paid_access_passes UNION SELECT user_email FROM manual_access_grants
      UNION SELECT recipient_email AS user_email FROM sponsored_access_passes WHERE recipient_email IS NOT NULL
    ) SELECT e.user_email,
      COALESCE(s.plan_interval,
        (SELECT plan_interval FROM manual_access_grants m WHERE m.user_email = e.user_email AND m.status = 'active' AND m.expires_at > ? ORDER BY m.expires_at DESC LIMIT 1),
        CASE WHEN EXISTS (SELECT 1 FROM paid_access_passes p WHERE p.user_email = e.user_email AND p.status = 'active' AND p.expires_at > ?) THEN 'starter_week' ELSE 'none' END) AS plan_interval,
      CASE WHEN s.status IS NOT NULL THEN s.status
        WHEN EXISTS (SELECT 1 FROM manual_access_grants m WHERE m.user_email = e.user_email AND m.status = 'active' AND m.expires_at > ?) THEN 'manual'
        WHEN EXISTS (SELECT 1 FROM paid_access_passes p WHERE p.user_email = e.user_email AND p.status = 'active' AND p.expires_at > ?) THEN 'starter'
        WHEN EXISTS (SELECT 1 FROM sponsored_access_passes a WHERE a.recipient_email = e.user_email AND a.status = 'claimed' AND a.expires_at > ?) THEN 'sponsored'
        ELSE 'none' END AS status,
      s.current_period_end, COALESCE(s.cancel_at_period_end, 0) AS cancel_at_period_end, s.last_payment_error,
      (SELECT expires_at FROM manual_access_grants m WHERE m.user_email = e.user_email AND m.status = 'active' AND m.expires_at > ? ORDER BY expires_at DESC LIMIT 1) AS manual_expires_at,
      COALESCE((SELECT SUM(amount_paid - refunded_amount) FROM payment_history p WHERE p.user_email = e.user_email AND p.status IN ('paid', 'partially_refunded', 'refunded')), 0) AS total_paid
      FROM student_emails e LEFT JOIN subscriptions s ON s.user_email = e.user_email ORDER BY e.user_email`)
      .bind(...Array(6).fill(new Date().toISOString())).all<{ user_email: string; plan_interval: string; status: string; current_period_end: string | null; cancel_at_period_end: number; last_payment_error: string | null; manual_expires_at: string | null; total_paid: number }>(),
    getD1().prepare(`SELECT id, user_email, plan_interval, status, expires_at, note, granted_by, created_at FROM manual_access_grants ORDER BY created_at DESC LIMIT 100`).all<{ id: number; user_email: string; plan_interval: string; status: string; expires_at: string; note: string | null; granted_by: string; created_at: string }>(),
    getD1().prepare(`SELECT id, code, percent_off, max_redemptions, redemption_count, reserved_count, expires_at, active FROM promotion_codes ORDER BY created_at DESC LIMIT 100`).all<{ id: number; code: string; percent_off: number; max_redemptions: number | null; redemption_count: number; reserved_count: number; expires_at: string | null; active: number }>(),
    getD1().prepare(`SELECT id, user_email, amount_paid, refunded_amount, currency, status, plan_interval, paid_at, receipt_url FROM payment_history ORDER BY paid_at DESC LIMIT 100`).all<{ id: number; user_email: string; amount_paid: number; refunded_amount: number; currency: string; status: string; plan_interval: string; paid_at: string; receipt_url: string | null }>(),
  ]);
  return {
    students: (students.results ?? []).map((row) => ({ email: row.user_email, planInterval: row.plan_interval, status: row.status, currentPeriodEnd: row.current_period_end, cancelAtPeriodEnd: Boolean(row.cancel_at_period_end), lastPaymentError: row.last_payment_error, manualExpiresAt: row.manual_expires_at, totalPaid: Number(row.total_paid ?? 0) })),
    grants: (grants.results ?? []).map((row) => ({ id: row.id, userEmail: row.user_email, planInterval: row.plan_interval, status: row.status, expiresAt: row.expires_at, note: row.note, grantedBy: row.granted_by, createdAt: row.created_at })),
    promotions: (promotions.results ?? []).map((row) => ({ id: row.id, code: row.code, percentOff: row.percent_off, maxRedemptions: row.max_redemptions, redemptionCount: row.redemption_count, reservedCount: row.reserved_count, expiresAt: row.expires_at, active: Boolean(row.active) })),
    payments: (payments.results ?? []).map((row) => ({ id: row.id, userEmail: row.user_email, amountPaid: row.amount_paid, refundedAmount: row.refunded_amount, currency: row.currency, status: row.status, planInterval: row.plan_interval, paidAt: row.paid_at, receiptUrl: row.receipt_url })),
  };
}

export { normalizeCode };
