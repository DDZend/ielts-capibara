"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Gift, ShieldCheck, Sparkles, XCircle } from "lucide-react";

type PassView = { passCode: string; accessHours: number; status: string; claimedAt: string | null; expiresAt: string | null } | null;

export function SponsoredAccessClient({ userName, code, pass }: { userName: string; code: string; pass: PassView }) {
  const [state, setState] = useState<"ready" | "claiming" | "claimed" | "error">("ready");
  const [error, setError] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(pass?.expiresAt ?? null);
  const available = pass?.status === "available";

  const claim = async () => {
    setState("claiming");
    const response = await fetch("/api/sponsored-pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => null);
    const data = response ? await response.json().catch(() => null) as { expiresAt?: string; error?: string } | null : null;
    if (!response?.ok || !data?.expiresAt) {
      setError(data?.error ?? "The pass could not be claimed. Please try again.");
      setState("error");
      return;
    }
    setExpiresAt(data.expiresAt);
    setState("claimed");
  };

  const invalid = !pass || (!available && state !== "claimed");
  return <main className="claim-shell">
    <Link className="claim-brand" href="/"><img src="/capi-profile.png" alt="" /><span><b>IELTS</b> Mastery</span></Link>
    <section className="claim-card">
      <div className="claim-art"><span><Gift /></span><img src="/capi-welcome.png" alt="Capy Coach welcoming a sponsored learner" /></div>
      {state === "claimed" ? <div className="claim-copy success"><span className="claim-kicker"><CheckCircle2 /> PASS ACTIVATED</span><h1>Your free study day starts now.</h1><p>You have full IELTS Mastery access until <b>{expiresAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(expiresAt)) : "tomorrow"}</b>.</p><Link href="/dashboard">Open my dashboard <ArrowRight /></Link></div>
      : invalid ? <div className="claim-copy invalid"><span className="claim-kicker"><XCircle /> PASS UNAVAILABLE</span><h1>{pass?.status === "expired" ? "This study pass has expired." : pass?.status === "claimed" ? "This pass has already been claimed." : "This pass link is not valid."}</h1><p>A Capy-Helper gift can be claimed once by one student. Ask the sender for a new link if you think this is a mistake.</p><Link href="/dashboard">Go to dashboard <ArrowRight /></Link></div>
      : <div className="claim-copy"><span className="claim-kicker"><Sparkles /> A LEARNER SPONSORED YOU</span><h1>One focused day.<br /><em>Completely free.</em></h1><p>Welcome, {userName.split(/\s|@/)[0]}. Claim this gift to unlock all four IELTS modules, AI practice feedback and your personalised dashboard for 24 hours.</p><div className="claim-facts"><span><Clock3 /><b>24 hours</b><small>Starts when claimed</small></span><span><ShieldCheck /><b>No payment</b><small>No card required</small></span></div>{state === "error" && <p className="claim-error" role="alert">{error}</p>}<button onClick={() => void claim()} disabled={state === "claiming"}>{state === "claiming" ? "Activating your pass…" : <>Claim my free study day <ArrowRight /></>}</button><small className="claim-code">Private pass · {code}</small></div>}
    </section>
  </main>;
}
