"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, BadgePercent, BellRing, Check, CheckCircle2, Clock3, Copy, CreditCard, Crown, ExternalLink, Gift, GraduationCap, History, LockKeyhole, MonitorPlay, ReceiptText, ShieldCheck, Sparkles, Star, Users } from "lucide-react";
import type { BillingSummary } from "../../db";
import { BILLING_PACKAGES, BILLING_PLANS, billingPlanLabel, billingTierRank, discountedAmount, formatCurrency, type BillingPlanId, type BillingTier } from "../../lib/billing-config";

type BillingClientProps = {
  userName: string; summary: BillingSummary; checkoutConfigured: boolean; paywallActive: boolean;
  accessRequired: boolean; checkoutResult: "success" | "cancelled" | null;
};

export function BillingClient({ userName, summary, checkoutConfigured, paywallActive, accessRequired, checkoutResult }: BillingClientProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promotion, setPromotion] = useState<{ code: string; percentOff: number } | null>(null);
  const [selectedPlans, setSelectedPlans] = useState<Record<BillingTier, BillingPlanId>>({ silver: "silver_month", gold: "gold_3_months", platinum: "platinum_month" });
  const activeSubscription = summary.subscription && ["active", "trialing", "past_due"].includes(summary.subscription.status);
  const hasAccess = Boolean(activeSubscription || summary.manualGrant || summary.activePass || summary.starterPass || !paywallActive);
  const activeRank = billingTierRank(summary.subscription?.planInterval ?? "");
  const firstName = userName.split(/[\s@]/)[0] || "Student";

  const openSession = async (endpoint: string, payload?: object) => {
    setBusy(endpoint); setMessage("");
    const response = await fetch(endpoint, { method: "POST", headers: payload ? { "Content-Type": "application/json" } : undefined, body: payload ? JSON.stringify(payload) : undefined }).catch(() => null);
    const data = response ? await response.json().catch(() => null) as { url?: string; updated?: boolean; error?: string } | null : null;
    if (response?.ok && data?.url) window.location.assign(data.url);
    else if (response?.ok && data?.updated) window.location.assign("/billing?checkout=success");
    else { setMessage(data?.error ?? "The secure billing page could not be opened. Please try again."); setBusy(null); }
  };

  const applyPromotion = async () => {
    setBusy("promo"); setMessage("");
    const response = await fetch("/api/billing/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promoInput }) }).catch(() => null);
    const data = response ? await response.json().catch(() => null) as { code?: string; percentOff?: number; error?: string } | null : null;
    if (response?.ok && data?.code && data.percentOff) { setPromotion({ code: data.code, percentOff: data.percentOff }); setMessage(`${data.code} is ready: ${data.percentOff}% off the first payment.`); }
    else { setPromotion(null); setMessage(data?.error ?? "That promotion code could not be applied."); }
    setBusy(null);
  };

  const copyPass = async (code: string) => {
    const url = `${window.location.origin}/sponsored-access?code=${encodeURIComponent(code)}`;
    await navigator.clipboard.writeText(url).catch(() => undefined); setCopied(code); window.setTimeout(() => setCopied(null), 1800);
  };

  const activeAccessLabel = activeSubscription
    ? summary.subscription?.status === "past_due" ? "Payment grace period" : "Membership active"
    : summary.manualGrant ? "Teacher-granted membership" : summary.starterPass ? "Starter Pass active"
      : summary.activePass ? "Sponsored pass active" : hasAccess ? "Open during launch" : "Membership needed";

  return <main className="billing-shell">
    <header className="billing-topbar"><Link href="/dashboard"><ArrowLeft /> Dashboard</Link><Link className="billing-brand" href="/"><img src="/capi-profile.png" alt="" /><span><b>IELTS</b> Mastery</span></Link><span><ShieldCheck /> Secure membership</span></header>
    <section className="billing-hero"><div><span className="billing-kicker"><Sparkles /> Membership & sponsored access</span><h1>Choose your path.<br /><em>Keep every achievement.</em></h1><p>{firstName}, start with seven days of platform access or choose self-study, guided group learning, or personal teacher coaching.</p><div className="billing-access-chip"><BadgeCheck /><span><small>Your access</small><b>{activeAccessLabel}</b></span></div></div><div className="billing-hero-art"><span><Star fill="currentColor" /><b>{summary.earnedCoins.toLocaleString()}</b><small>lifetime-earned coins</small></span><img src="/capi-plan.png" alt="Capi Coach planning a study membership" /></div></section>

    <div className="billing-page">
      {accessRequired && <div className="billing-alert warning"><LockKeyhole /><span><b>Choose access to continue learning</b><small>Your dashboard and assessment remain available while you choose a subscription or claim a sponsored pass.</small></span></div>}
      {checkoutResult === "success" && <div className="billing-alert success"><CheckCircle2 /><span><b>Payment confirmed or upgrade submitted</b><small>Signed Stripe events activate the correct access and update the receipt history automatically.</small></span></div>}
      {checkoutResult === "cancelled" && <div className="billing-alert neutral"><CreditCard /><span><b>No payment was taken</b><small>You left checkout before completing payment.</small></span></div>}
      {!checkoutConfigured && <div className="billing-alert setup"><ShieldCheck /><span><b>Secure checkout is being connected</b><small>Plans and billing records are ready, but payment buttons stay disabled until Stripe secrets and the webhook are linked.</small></span></div>}
      {summary.starterCredit && <div className="billing-alert success"><Gift /><span><b>{formatCurrency(summary.starterCredit.amount)} upgrade credit ready</b><small>The amount you paid for Starter will be deducted once from your first Silver, Gold, or Platinum checkout.</small></span></div>}
      {summary.subscription?.status === "past_due" && <div className="billing-alert warning"><CreditCard /><span><b>Payment needs attention</b><small>{summary.subscription.lastPaymentError ?? "Update your payment method before the grace period ends."}{summary.subscription.graceUntil ? ` Grace access ends ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(summary.subscription.graceUntil))}.` : ""}</small></span></div>}
      {summary.notifications.map((notification) => <div className={`billing-alert ${notification.kind === "payment_failed" ? "warning" : "neutral"}`} key={notification.id}><BellRing /><span><b>{notification.title}</b><small>{notification.message}</small></span>{notification.actionUrl && <Link href={notification.actionUrl}>Open <ArrowRight /></Link>}</div>)}
      {message && <div className="billing-alert warning" role="alert"><CreditCard /><span><b>Billing update</b><small>{message}</small></span></div>}

      <section className="billing-status-grid">
        <article><span><CreditCard /></span><div><small>Current membership</small><h2>{activeSubscription ? `${billingPlanLabel(summary.subscription?.planInterval ?? "")} plan` : summary.manualGrant ? `${billingPlanLabel(summary.manualGrant.planInterval)} grant` : "No paid plan"}</h2><p>{activeSubscription ? summary.subscription?.currentPeriodEnd ? `${summary.subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} ${new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(summary.subscription.currentPeriodEnd))}` : "Active and ready" : summary.manualGrant ? `Teacher-granted access until ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(summary.manualGrant.expiresAt))}` : "Choose a plan below or claim a gift pass."}</p></div>{summary.subscription?.hasCustomer && <button onClick={() => void openSession("/api/billing/portal")} disabled={busy !== null}>{busy === "/api/billing/portal" ? "Opening…" : <>Manage billing <ExternalLink /></>}</button>}</article>
        <article><span><Clock3 /></span><div><small>Pass access</small><h2>{summary.starterPass ? "7-Day Starter active" : summary.activePass ? "24-hour gift active" : "No active pass"}</h2><p>{summary.starterPass ? `Available until ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(summary.starterPass.expiresAt))}` : summary.activePass ? `Available until ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(summary.activePass.expiresAt))}` : "Buy a Starter Pass or claim a Capi-Helper gift."}</p></div></article>
        <article><span><Star fill="currentColor" /></span><div><small>Your checkout discount</small><h2>{summary.discountPercent ? `${summary.discountPercent}% unlocked` : "Keep earning"}</h2><p>Based on {summary.earnedCoins.toLocaleString()} lifetime-earned Capi-Coins. Giving a pass does not remove your discount.</p></div></article>
      </section>

      <section className="billing-plans package-pricing">
        <header><div><span>MEMBERSHIP OPTIONS</span><h2>Start independently. Add support when you need it.</h2><p>New memberships activate immediately after Stripe confirms payment. Higher-tier upgrades automatically credit unused plan value.</p></div><span className="billing-discount-badge"><Star fill="currentColor" /> {summary.discountPercent ? `${summary.discountPercent}% Capi discount` : "Discounts from 500 coins"}</span></header>
        <div className="billing-promo-box"><BadgePercent /><div><b>Have a promotion code?</b><small>It reduces the first payment while your Capi-Coin discount remains automatic.</small></div><input value={promoInput} onChange={(event) => { setPromoInput(event.target.value.toUpperCase()); setPromotion(null); }} maxLength={32} placeholder="ENTER CODE" /><button disabled={!promoInput.trim() || busy !== null || Boolean(activeSubscription)} onClick={() => void applyPromotion()}>{busy === "promo" ? "Checking…" : promotion ? <><Check /> Applied</> : "Apply code"}</button></div>

        <article className="starter-pass-card"><div className="starter-pass-icon"><Clock3 /></div><div><small>7-DAY STARTER PASS</small><h3>Try the complete platform for one focused week.</h3><p>All four modules, AI feedback, adaptive planning and mock practice. No online teacher meetings.</p></div><span><b>{formatCurrency(discountedAmount(discountedAmount(BILLING_PLANS.starter_week.amount, summary.discountPercent), promotion?.percentOff ?? 0))}</b><small>amount paid is credited if you upgrade</small></span><button disabled={!checkoutConfigured || Boolean(activeSubscription) || summary.hasStarterPurchase || busy !== null} onClick={() => void openSession("/api/billing/checkout", { plan: "starter_week", promoCode: promotion?.code })}>{summary.starterPass ? "Starter Pass active" : summary.hasStarterPurchase ? "Starter Pass already used" : busy === "/api/billing/checkout" ? "Opening checkout…" : checkoutConfigured ? <>Get 7-day access <ArrowRight /></> : <><LockKeyhole /> Checkout coming soon</>}</button></article>

        <div className="billing-package-grid">{BILLING_PACKAGES.map((membership) => {
          const selectedId = selectedPlans[membership.tier]; const selectedPlan = BILLING_PLANS[selectedId];
          const discounted = discountedAmount(selectedPlan.amount, summary.discountPercent);
          const firstPayment = discountedAmount(discounted, activeSubscription ? 0 : promotion?.percentOff ?? 0);
          const canUpgrade = Boolean(activeSubscription && billingTierRank(selectedId) > activeRank);
          const TierIcon = membership.tier === "silver" ? MonitorPlay : membership.tier === "gold" ? GraduationCap : Crown;
          return <article className={`membership-package ${membership.tier}`} key={membership.tier}>{membership.badge && <span className="package-badge">{membership.badge}</span>}<span className="plan-icon"><TierIcon /></span><small>{membership.name.toUpperCase()}</small><h3>{membership.subtitle}</h3><p className="meeting-label"><Users /> {membership.meetingLabel}</p><div className="package-duration-options" aria-label={`${membership.name} duration`}>{membership.planIds.map((planId) => { const option = BILLING_PLANS[planId]; return <button type="button" className={selectedId === planId ? "selected" : ""} aria-pressed={selectedId === planId} onClick={() => setSelectedPlans((current) => ({ ...current, [membership.tier]: planId }))} key={planId}><span>{option.durationLabel}</span><b>{formatCurrency(discountedAmount(option.amount, summary.discountPercent))}</b></button>; })}</div><div className="package-price"><small>{promotion && !activeSubscription ? "First payment with promotion" : "Selected package"}</small><strong>{formatCurrency(firstPayment)}</strong>{summary.discountPercent > 0 && <span><s>{formatCurrency(selectedPlan.amount)}</s> · {summary.discountPercent}% Capi discount</span>}{promotion && !activeSubscription && <em>{promotion.code} adds {promotion.percentOff}% off the first payment</em>}{summary.starterCredit && <em>Plus {formatCurrency(summary.starterCredit.amount)} Starter credit at checkout</em>}</div><ul>{membership.features.map((feature) => <li key={feature}><Check /> {feature}</li>)}</ul><button className="package-checkout" disabled={!checkoutConfigured || (Boolean(activeSubscription) && !canUpgrade) || busy !== null} onClick={() => void openSession("/api/billing/checkout", { plan: selectedId, promoCode: activeSubscription ? undefined : promotion?.code })}>{activeSubscription ? canUpgrade ? <>Upgrade to {membership.name} <ArrowRight /></> : billingTierRank(selectedId) === activeRank ? "Current support tier" : "Lower tier unavailable" : busy === "/api/billing/checkout" ? "Opening secure checkout…" : checkoutConfigured ? <>Choose {membership.name} <ArrowRight /></> : <><LockKeyhole /> Checkout coming soon</>}</button></article>;
        })}</div>
      </section>

      <section className="billing-lower-grid"><article className="billing-passes-card"><header><span><Gift /></span><div><small>CAPI HELPER</small><h2>Your sponsored passes</h2><p>Every 500-coin gift creates a private link for one new learner.</p></div><Link href="/dashboard">Sponsor another <ArrowRight /></Link></header>{summary.sponsoredPasses.length ? <div className="billing-pass-list">{summary.sponsoredPasses.map((pass) => <div key={pass.id}><span className={`pass-state ${pass.status}`}><Users /> {pass.status === "available" ? "Ready to share" : pass.status === "claimed" ? "Claimed" : "Expired"}</span><div><b>24-hour access pass</b><small>Created {new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(pass.createdAt))}{pass.recipientEmail ? ` · ${pass.recipientEmail}` : ""}</small></div>{pass.status === "available" ? <button onClick={() => void copyPass(pass.passCode)}>{copied === pass.passCode ? <><Check /> Copied</> : <><Copy /> Copy claim link</>}</button> : <span className="pass-date">{pass.expiresAt ? `Expires ${new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(pass.expiresAt))}` : "Used"}</span>}</div>)}</div> : <div className="billing-empty"><Gift /><b>No sponsored passes yet</b><p>Open Capi-Coins on your dashboard when you have 500 available coins.</p></div>}</article>
        <article className="billing-history-card"><header><span><History /></span><div><small>ACCOUNT RECORDS</small><h2>Payment history</h2><p>Receipts, renewals, failures and refunds remain attached to your account.</p></div></header>{summary.payments.length ? <div className="billing-payment-list">{summary.payments.map((payment) => <div key={payment.id}><span className={payment.status}><ReceiptText /></span><div><b>{billingPlanLabel(payment.planInterval)} membership</b><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(payment.paidAt))} · {payment.discountPercent}% Capi discount{payment.promotionCode ? ` · ${payment.promotionCode}` : ""}{payment.failureReason ? ` · ${payment.failureReason}` : ""}</small>{(payment.receiptUrl || payment.invoicePdfUrl) && <a href={payment.receiptUrl ?? payment.invoicePdfUrl ?? "#"} target="_blank" rel="noreferrer"><ExternalLink /> View receipt</a>}</div><strong>{formatCurrency(payment.amountPaid - payment.refundedAmount, payment.currency)}<small>{payment.status}{payment.refundedAmount ? ` · ${formatCurrency(payment.refundedAmount, payment.currency)} refunded` : ""}</small></strong></div>)}</div> : <div className="billing-empty"><ReceiptText /><b>No payments yet</b><p>Your receipt history will stay attached to this signed-in account.</p></div>}</article></section>
    </div>
  </main>;
}
