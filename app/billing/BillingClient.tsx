"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarClock, Check, CheckCircle2, Clock3, Copy, CreditCard, ExternalLink, Gift, History, LockKeyhole, ReceiptText, ShieldCheck, Sparkles, Star, Users } from "lucide-react";
import type { BillingSummary } from "../../db";
import { BILLING_PLANS, discountedAmount, formatUsd } from "../../lib/billing-config";

type BillingClientProps = {
  userName: string;
  summary: BillingSummary;
  checkoutConfigured: boolean;
  paywallActive: boolean;
  accessRequired: boolean;
  checkoutResult: "success" | "cancelled" | null;
};

export function BillingClient({ userName, summary, checkoutConfigured, paywallActive, accessRequired, checkoutResult }: BillingClientProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const activeSubscription = summary.subscription && ["active", "trialing"].includes(summary.subscription.status);
  const hasAccess = Boolean(activeSubscription || summary.activePass || !paywallActive);
  const firstName = userName.split(/[\s@]/)[0] || "Student";

  const openSession = async (endpoint: string, payload?: object) => {
    setBusy(endpoint);
    setMessage("");
    const response = await fetch(endpoint, { method: "POST", headers: payload ? { "Content-Type": "application/json" } : undefined, body: payload ? JSON.stringify(payload) : undefined }).catch(() => null);
    const data = response ? await response.json().catch(() => null) as { url?: string; error?: string } | null : null;
    if (response?.ok && data?.url) window.location.assign(data.url);
    else {
      setMessage(data?.error ?? "The secure billing page could not be opened. Please try again.");
      setBusy(null);
    }
  };

  const copyPass = async (code: string) => {
    const url = `${window.location.origin}/sponsored-access?code=${encodeURIComponent(code)}`;
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(code);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <main className="billing-shell">
      <header className="billing-topbar">
        <Link href="/dashboard"><ArrowLeft /> Dashboard</Link>
        <Link className="billing-brand" href="/"><img src="/capi-profile.png" alt="" /><span><b>IELTS</b> Mastery</span></Link>
        <span><ShieldCheck /> Secure membership</span>
      </header>

      <section className="billing-hero">
        <div>
          <span className="billing-kicker"><Sparkles /> Membership & sponsored access</span>
          <h1>Choose your path.<br /><em>Keep every achievement.</em></h1>
          <p>{firstName}, monthly and annual access include all four learning modules, saved progress, AI feedback and weekend mock comparisons.</p>
          <div className="billing-access-chip"><BadgeCheck /><span><small>Your access</small><b>{hasAccess ? activeSubscription ? "Subscription active" : summary.activePass ? "Sponsored pass active" : "Open during launch" : "Membership needed"}</b></span></div>
        </div>
        <div className="billing-hero-art"><span><Star fill="currentColor" /><b>{summary.earnedCoins.toLocaleString()}</b><small>lifetime-earned coins</small></span><img src="/capi-plan.png" alt="Capi Coach planning a study membership" /></div>
      </section>

      <div className="billing-page">
        {accessRequired && <div className="billing-alert warning"><LockKeyhole /><span><b>Choose access to continue learning</b><small>Your dashboard and assessment remain available while you choose a subscription or claim a sponsored pass.</small></span></div>}
        {checkoutResult === "success" && <div className="billing-alert success"><CheckCircle2 /><span><b>Checkout completed</b><small>Stripe is confirming your subscription. This page will show the final status as soon as its signed event arrives.</small></span></div>}
        {checkoutResult === "cancelled" && <div className="billing-alert neutral"><CreditCard /><span><b>No payment was taken</b><small>You left checkout before completing payment.</small></span></div>}
        {!checkoutConfigured && <div className="billing-alert setup"><ShieldCheck /><span><b>Secure checkout is being connected</b><small>Plans and discounts are ready, but payment buttons stay disabled until the Stripe account is linked. Sponsored pass claiming already works.</small></span></div>}
        {message && <div className="billing-alert warning" role="alert"><CreditCard /><span><b>Billing update</b><small>{message}</small></span></div>}

        <section className="billing-status-grid">
          <article>
            <span><CreditCard /></span><div><small>Current membership</small><h2>{activeSubscription ? `${summary.subscription?.planInterval === "annual" ? "Annual" : "Monthly"} plan` : "No paid plan"}</h2><p>{activeSubscription ? summary.subscription?.currentPeriodEnd ? `${summary.subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} ${new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(summary.subscription.currentPeriodEnd))}` : "Active and ready" : "Choose a plan below or claim a gift pass."}</p></div>
            {summary.subscription?.hasCustomer && <button onClick={() => void openSession("/api/billing/portal")} disabled={busy !== null}>{busy === "/api/billing/portal" ? "Opening…" : <>Manage <ExternalLink /></>}</button>}
          </article>
          <article>
            <span><Clock3 /></span><div><small>Sponsored access</small><h2>{summary.activePass ? "24-hour pass active" : "No active pass"}</h2><p>{summary.activePass ? `Available until ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(summary.activePass.expiresAt))}` : "A student can share a Capi-Helper claim link with you."}</p></div>
          </article>
          <article>
            <span><Star fill="currentColor" /></span><div><small>Your checkout discount</small><h2>{summary.discountPercent ? `${summary.discountPercent}% unlocked` : "Keep earning"}</h2><p>Based on {summary.earnedCoins.toLocaleString()} lifetime-earned Capi-Coins. Giving a pass does not remove your discount.</p></div>
          </article>
        </section>

        <section className="billing-plans">
          <header><div><span>SUBSCRIPTION OPTIONS</span><h2>Simple access, paid your way</h2><p>Discounts are recalculated securely from your learning history at checkout.</p></div><span className="billing-discount-badge"><Star fill="currentColor" /> {summary.discountPercent ? `${summary.discountPercent}% Capi discount` : "Discounts from 500 coins"}</span></header>
          <div className="billing-plan-grid">
            {(Object.keys(BILLING_PLANS) as Array<keyof typeof BILLING_PLANS>).map((planId) => {
              const plan = BILLING_PLANS[planId];
              const discounted = discountedAmount(plan.amount, summary.discountPercent);
              return <article className={planId === "annual" ? "featured" : ""} key={planId}>
                {planId === "annual" && <span className="best-value">BEST VALUE</span>}
                <span className="plan-icon">{planId === "annual" ? <CalendarClock /> : <CreditCard />}</span>
                <small>{plan.label.toUpperCase()}</small><h3>{formatUsd(discounted)}<em>/{plan.interval}</em></h3>
                {summary.discountPercent > 0 && <p className="original-price"><s>{formatUsd(plan.amount)}</s> with {summary.discountPercent}% Capi-Coin discount</p>}
                <p>{plan.description}</p>
                <ul><li><Check /> All four IELTS modules</li><li><Check /> Speaking & Writing AI feedback</li><li><Check /> Adaptive weekly plan and reports</li><li><Check /> Weekend mock comparisons</li></ul>
                <button disabled={!checkoutConfigured || Boolean(activeSubscription) || busy !== null} onClick={() => void openSession("/api/billing/checkout", { plan: planId })}>
                  {activeSubscription ? "Current membership active" : busy === "/api/billing/checkout" ? "Opening secure checkout…" : checkoutConfigured ? <>Choose {plan.label.toLowerCase()} <ArrowRight /></> : <><LockKeyhole /> Checkout coming soon</>}
                </button>
              </article>;
            })}
          </div>
        </section>

        <section className="billing-lower-grid">
          <article className="billing-passes-card">
            <header><span><Gift /></span><div><small>CAPI HELPER</small><h2>Your sponsored passes</h2><p>Every 500-coin gift creates a private link for one new learner.</p></div><Link href="/dashboard">Sponsor another <ArrowRight /></Link></header>
            {summary.sponsoredPasses.length ? <div className="billing-pass-list">{summary.sponsoredPasses.map((pass) => <div key={pass.id}><span className={`pass-state ${pass.status}`}><Users /> {pass.status === "available" ? "Ready to share" : pass.status === "claimed" ? "Claimed" : "Expired"}</span><div><b>24-hour access pass</b><small>Created {new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(pass.createdAt))}{pass.recipientEmail ? ` · ${pass.recipientEmail}` : ""}</small></div>{pass.status === "available" ? <button onClick={() => void copyPass(pass.passCode)}>{copied === pass.passCode ? <><Check /> Copied</> : <><Copy /> Copy claim link</>}</button> : <span className="pass-date">{pass.expiresAt ? `Expires ${new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(pass.expiresAt))}` : "Used"}</span>}</div>)}</div> : <div className="billing-empty"><Gift /><b>No sponsored passes yet</b><p>Open Capi-Coins on your dashboard when you have 500 available coins.</p></div>}
          </article>

          <article className="billing-history-card">
            <header><span><History /></span><div><small>ACCOUNT RECORDS</small><h2>Payment history</h2><p>Successful and failed renewals appear here after Stripe confirms them.</p></div></header>
            {summary.payments.length ? <div className="billing-payment-list">{summary.payments.map((payment) => <div key={payment.id}><span className={payment.status}><ReceiptText /></span><div><b>{payment.planInterval === "annual" ? "Annual" : "Monthly"} membership</b><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(payment.paidAt))} · {payment.discountPercent}% discount</small></div><strong>{formatUsd(payment.amountPaid)}<small>{payment.status}</small></strong></div>)}</div> : <div className="billing-empty"><ReceiptText /><b>No payments yet</b><p>Your receipt history will stay attached to this signed-in account.</p></div>}
          </article>
        </section>
      </div>
    </main>
  );
}
