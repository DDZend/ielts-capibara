"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, BadgePercent, Ban, Check, CircleAlert, CreditCard, ExternalLink, Gift, LoaderCircle, ReceiptText, RefreshCw, ShieldCheck, UserRoundCheck, Users } from "lucide-react";
import type { MembershipAdminSnapshot } from "../../../db/billing";
import { billingPlanLabel, formatCurrency, type BillingPlanId } from "../../../lib/billing-config";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)) : "—";

export function MembershipAdminClient({ userName, initialSnapshot }: { userName: string; initialSnapshot: MembershipAdminSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [grant, setGrant] = useState<{ email: string; plan: BillingPlanId; days: string; note: string }>({ email: "", plan: "silver_month", days: "30", note: "" });
  const [promo, setPromo] = useState({ code: "", percent: "10", maxRedemptions: "", expiresAt: "" });
  const activeCount = snapshot.students.filter((student) => ["active", "trialing", "manual", "starter", "sponsored"].includes(student.status)).length;
  const failedCount = snapshot.students.filter((student) => student.status === "past_due" || student.lastPaymentError).length;
  const netRevenue = useMemo(() => snapshot.payments.reduce((total, payment) => total + payment.amountPaid - payment.refundedAmount, 0), [snapshot.payments]);

  const act = async (name: string, payload: Record<string, unknown>, success: string) => {
    setBusy(name); setMessage(""); setError("");
    try {
      const response = await fetch("/api/creator/memberships", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { snapshot?: MembershipAdminSnapshot; error?: string };
      if (!response.ok || !data.snapshot) throw new Error(data.error ?? "The membership action could not be completed.");
      setSnapshot(data.snapshot); setMessage(success);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The membership action could not be completed."); }
    finally { setBusy(""); }
  };

  const refresh = async () => {
    setBusy("refresh"); setError("");
    const response = await fetch("/api/creator/memberships").catch(() => null);
    const data = response ? await response.json().catch(() => null) as { snapshot?: MembershipAdminSnapshot; error?: string } | null : null;
    if (response?.ok && data?.snapshot) { setSnapshot(data.snapshot); setMessage("Membership records refreshed."); }
    else setError(data?.error ?? "Could not refresh membership records.");
    setBusy("");
  };

  return <main className="membership-admin-shell">
    <header className="membership-admin-topbar"><Link href="/creator"><ArrowLeft /> Creator Studio</Link><span><ShieldCheck /> Teacher-only billing controls</span><div><small>Signed in as</small><b>{userName}</b></div></header>
    <section className="membership-admin-hero"><div><span><CreditCard /> MEMBERSHIP OPERATIONS</span><h1>Access, payments and student care.</h1><p>See every learner’s entitlement, grant access, manage offers, resolve failed payments, cancel plans and issue auditable refunds.</p></div><button onClick={() => void refresh()} disabled={Boolean(busy)}>{busy === "refresh" ? <LoaderCircle className="spin" /> : <RefreshCw />} Refresh Stripe records</button></section>
    <div className="membership-admin-page">
      {(message || error) && <p className={`membership-admin-message ${error ? "error" : "success"}`}>{error ? <CircleAlert /> : <Check />}{error || message}</p>}
      <section className="membership-admin-metrics"><article><Users /><span><small>KNOWN STUDENTS</small><b>{snapshot.students.length}</b></span></article><article><UserRoundCheck /><span><small>ACTIVE ACCESS</small><b>{activeCount}</b></span></article><article><CircleAlert /><span><small>PAYMENT ATTENTION</small><b>{failedCount}</b></span></article><article><ReceiptText /><span><small>RECORDED NET REVENUE</small><b>{formatCurrency(netRevenue)}</b></span></article></section>

      <section className="membership-admin-actions">
        <form onSubmit={(event) => { event.preventDefault(); void act("grant", { action: "manual_grant", ...grant, days: Number(grant.days) }, "Manual access granted immediately."); }}>
          <header><Gift /><div><small>MANUAL ACCESS</small><h2>Grant a membership</h2><p>Useful for scholarships, bank transfers, staff or goodwill access.</p></div></header>
          <label><span>Student email</span><input type="email" required value={grant.email} onChange={(event) => setGrant((current) => ({ ...current, email: event.target.value }))} placeholder="student@example.com" /></label>
          <div><label><span>Access level</span><select value={grant.plan} onChange={(event) => setGrant((current) => ({ ...current, plan: event.target.value as BillingPlanId }))}><option value="silver_month">Silver</option><option value="gold_month">Gold</option><option value="platinum_month">Platinum</option></select></label><label><span>Days</span><input type="number" min="1" max="365" required value={grant.days} onChange={(event) => setGrant((current) => ({ ...current, days: event.target.value }))} /></label></div>
          <label><span>Internal note</span><input maxLength={300} value={grant.note} onChange={(event) => setGrant((current) => ({ ...current, note: event.target.value }))} placeholder="Reason or reference" /></label>
          <button disabled={Boolean(busy)}>{busy === "grant" ? <LoaderCircle className="spin" /> : <UserRoundCheck />} Grant access now</button>
        </form>

        <form onSubmit={(event) => { event.preventDefault(); void act("promo", { action: "create_promo", code: promo.code, percent: Number(promo.percent), maxRedemptions: Number(promo.maxRedemptions), expiresAt: promo.expiresAt || null }, "Promotion code created."); }}>
          <header><BadgePercent /><div><small>PROMOTIONS</small><h2>Create a checkout code</h2><p>Codes apply once to the first payment and never replace the Capi-Coin discount.</p></div></header>
          <label><span>Code</span><input required minLength={3} maxLength={32} value={promo.code} onChange={(event) => setPromo((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="CAPI10" /></label>
          <div><label><span>Discount</span><select value={promo.percent} onChange={(event) => setPromo((current) => ({ ...current, percent: event.target.value }))}>{[5, 10, 15, 20, 25, 30, 40, 50].map((value) => <option value={value} key={value}>{value}%</option>)}</select></label><label><span>Maximum uses</span><input type="number" min="1" max="10000" value={promo.maxRedemptions} onChange={(event) => setPromo((current) => ({ ...current, maxRedemptions: event.target.value }))} placeholder="Unlimited" /></label></div>
          <label><span>Expires</span><input type="date" value={promo.expiresAt} onChange={(event) => setPromo((current) => ({ ...current, expiresAt: event.target.value }))} /></label>
          <button disabled={Boolean(busy)}>{busy === "promo" ? <LoaderCircle className="spin" /> : <BadgePercent />} Create promotion</button>
        </form>
      </section>

      <section className="membership-admin-panel"><header><div><small>STUDENT ACCESS</small><h2>Membership status</h2><p>Stripe subscriptions, passes and teacher grants appear in one operational view.</p></div></header><div className="membership-admin-table"><table><thead><tr><th>Student</th><th>Access</th><th>Status</th><th>Ends / renews</th><th>Net paid</th><th>Actions</th></tr></thead><tbody>{snapshot.students.map((student) => <tr key={student.email}><td><b>{student.email}</b>{student.lastPaymentError && <small>{student.lastPaymentError}</small>}</td><td>{billingPlanLabel(student.planInterval)}</td><td><span className={`admin-status ${student.status}`}>{student.status.replaceAll("_", " ")}</span></td><td>{date(student.manualExpiresAt ?? student.currentPeriodEnd)}{student.cancelAtPeriodEnd && <small>Cancellation scheduled</small>}</td><td>{formatCurrency(student.totalPaid)}</td><td>{student.status !== "none" && !["manual", "starter", "sponsored", "canceled"].includes(student.status) ? <div className="admin-row-actions"><button disabled={Boolean(busy)} onClick={() => void act(`cancel-${student.email}`, { action: "cancel_membership", email: student.email, timing: "period_end" }, "Cancellation scheduled for the end of the paid period.")}><Ban /> End at renewal</button><button className="danger" disabled={Boolean(busy)} onClick={() => { if (window.confirm(`End ${student.email}'s Stripe membership immediately?`)) void act(`cancel-now-${student.email}`, { action: "cancel_membership", email: student.email, timing: "immediate" }, "Membership cancelled immediately."); }}><Ban /> End now</button></div> : "—"}</td></tr>)}</tbody></table></div></section>

      <section className="membership-admin-grid">
        <article className="membership-admin-panel"><header><div><small>MANUAL GRANTS</small><h2>Granted access</h2></div></header><div className="admin-list">{snapshot.grants.length ? snapshot.grants.map((item) => <div key={item.id}><span><b>{item.userEmail}</b><small>{billingPlanLabel(item.planInterval)} · until {date(item.expiresAt)}{item.note ? ` · ${item.note}` : ""}</small></span><em className={`admin-status ${item.status}`}>{item.status}</em>{item.status === "active" && <button onClick={() => void act(`revoke-${item.id}`, { action: "revoke_grant", id: item.id }, "Manual access revoked.")} disabled={Boolean(busy)}>Revoke</button>}</div>) : <p>No manual grants yet.</p>}</div></article>
        <article className="membership-admin-panel"><header><div><small>PROMOTION CODES</small><h2>Offers</h2></div></header><div className="admin-list">{snapshot.promotions.length ? snapshot.promotions.map((item) => <div key={item.id}><span><b>{item.code} · {item.percentOff}%</b><small>{item.redemptionCount} redeemed · {item.reservedCount} in checkout · {item.maxRedemptions ?? "∞"} max · expires {date(item.expiresAt)}</small></span><em className={`admin-status ${item.active ? "active" : "canceled"}`}>{item.active ? "active" : "inactive"}</em><button onClick={() => void act(`promo-${item.id}`, { action: "toggle_promo", id: item.id, active: !item.active }, item.active ? "Promotion paused." : "Promotion reactivated.")} disabled={Boolean(busy)}>{item.active ? "Pause" : "Activate"}</button></div>) : <p>No promotion codes yet.</p>}</div></article>
      </section>

      <section className="membership-admin-panel"><header><div><small>PAYMENTS & REFUNDS</small><h2>Complete payment history</h2><p>Refunds are issued through Stripe. Access can be revoked separately when policy requires it.</p></div></header><div className="membership-admin-table"><table><thead><tr><th>Student</th><th>Package</th><th>Date</th><th>Paid</th><th>Refunded</th><th>Status</th><th>Actions</th></tr></thead><tbody>{snapshot.payments.map((payment) => <tr key={payment.id}><td><b>{payment.userEmail}</b></td><td>{billingPlanLabel(payment.planInterval)}</td><td>{date(payment.paidAt)}</td><td>{formatCurrency(payment.amountPaid, payment.currency)}</td><td>{formatCurrency(payment.refundedAmount, payment.currency)}</td><td><span className={`admin-status ${payment.status}`}>{payment.status.replaceAll("_", " ")}</span></td><td><div className="admin-row-actions">{payment.receiptUrl && <a href={payment.receiptUrl} target="_blank" rel="noreferrer"><ExternalLink /> Receipt</a>}{["paid", "partially_refunded"].includes(payment.status) && <button className="danger" disabled={Boolean(busy)} onClick={() => { const revoke = window.confirm("Press OK to refund AND revoke access. Press Cancel to choose a refund without revoking access in the next confirmation."); if (revoke || window.confirm("Issue the full refund but keep the current membership access?")) void act(`refund-${payment.id}`, { action: "refund_payment", id: payment.id, revokeAccess: revoke }, "Refund submitted to Stripe."); }}><ReceiptText /> Full refund</button>}</div></td></tr>)}</tbody></table></div></section>
    </div>
  </main>;
}
