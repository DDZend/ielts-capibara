"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Bell, Check, CircleAlert, Clock3, ExternalLink, GraduationCap, LoaderCircle, Mail, Megaphone, RefreshCw, RotateCw, Send, ShieldCheck, Users } from "lucide-react";
import type { CommunicationSnapshot } from "../../../lib/notifications";

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

export function CommunicationsClient({ userName, initialSnapshot }: { userName: string; initialSnapshot: CommunicationSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", message: "", audienceType: "all", audienceValue: "", actionUrl: "/dashboard" });

  async function act(action: string, payload: Record<string, unknown>, success: string) {
    setBusy(action); setMessage(""); setError("");
    try {
      const response = await fetch("/api/creator/communications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { snapshot?: CommunicationSnapshot; result?: { recipientCount?: number; generated?: number; sent?: number; failed?: number }; error?: string };
      if (!response.ok || !data.snapshot) throw new Error(data.error || "The communication action could not be completed.");
      setSnapshot(data.snapshot);
      const details = data.result?.recipientCount != null ? ` ${data.result.recipientCount} recipients.` : data.result?.generated != null ? ` ${data.result.generated} reminders checked; ${data.result.sent ?? 0} emails sent; ${data.result.failed ?? 0} waiting or failed.` : "";
      setMessage(`${success}${details}`);
      if (action === "announcement") setForm((current) => ({ ...current, title: "", message: "" }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The communication action could not be completed."); }
    finally { setBusy(""); }
  }

  async function refresh() {
    setBusy("refresh"); setError("");
    const response = await fetch("/api/creator/communications").catch(() => null);
    const data = response ? await response.json().catch(() => null) as { snapshot?: CommunicationSnapshot; error?: string } | null : null;
    if (response?.ok && data?.snapshot) { setSnapshot(data.snapshot); setMessage("Communication records refreshed."); } else setError(data?.error || "Could not refresh communication records.");
    setBusy("");
  }

  const selectAudience = (audienceType: string) => setForm((current) => ({ ...current, audienceType, audienceValue: audienceType === "student" ? snapshot.students[0]?.email ?? "" : audienceType === "cohort" ? String(snapshot.cohorts[0]?.id ?? "") : "" }));

  return <main className="class-admin-shell communication-shell">
    <header className="class-admin-topbar"><Link href="/teacher"><ArrowLeft /> Teacher workspace</Link><span><Bell /> Notifications & communication</span><div><small>Signed in as</small><b>{userName}</b></div></header>
    <section className="class-admin-hero communication-hero"><div><span><Megaphone /> ACTIVE STUDENT COMMUNICATION</span><h1>Keep every learner informed, automatically.</h1><p>Send targeted announcements, run scheduled reminders and see every queued, sent, opened or failed email without chasing students manually.</p></div><button onClick={() => void refresh()} disabled={Boolean(busy)}>{busy === "refresh" ? <LoaderCircle className="spin" /> : <RefreshCw />} Refresh history</button></section>
    <div className="communication-page">
      {(message || error) && <p className={`class-admin-message ${error ? "error" : "success"}`}>{error ? <CircleAlert /> : <Check />}{error || message}</p>}
      <section className="communication-metrics">
        <article><Bell /><span><small>ALL NOTIFICATIONS</small><b>{snapshot.stats.total}</b></span></article><article><CircleAlert /><span><small>UNREAD IN APP</small><b>{snapshot.stats.unread}</b></span></article><article><Clock3 /><span><small>QUEUED</small><b>{snapshot.stats.queued}</b></span></article><article><Send /><span><small>SENT / DELIVERED</small><b>{snapshot.stats.sent}</b></span></article><article><Mail /><span><small>OPENED</small><b>{snapshot.stats.opened}</b></span></article><article><RotateCw /><span><small>FAILED</small><b>{snapshot.stats.failed}</b></span></article>
      </section>
      <section className="communication-grid">
        <form className="class-admin-form communication-compose" onSubmit={(event) => { event.preventDefault(); void act("announcement", { action: "announcement", ...form }, "Announcement sent."); }}>
          <header><Megaphone /><div><small>TEACHER ANNOUNCEMENT</small><h2>Write once, reach the right students</h2></div></header>
          <label><span>Audience</span><select value={form.audienceType} onChange={(event) => selectAudience(event.target.value)}><option value="all">All students</option><option value="cohort">One cohort</option><option value="student">One student</option></select></label>
          {form.audienceType === "cohort" && <label><span>Cohort</span><select value={form.audienceValue} onChange={(event) => setForm((current) => ({ ...current, audienceValue: event.target.value }))}>{snapshot.cohorts.map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name} · {cohort.memberCount} students</option>)}</select></label>}
          {form.audienceType === "student" && <label><span>Student</span><select value={form.audienceValue} onChange={(event) => setForm((current) => ({ ...current, audienceValue: event.target.value }))}>{snapshot.students.map((student) => <option value={student.email} key={student.email}>{student.label} · {student.email}</option>)}</select></label>}
          <label><span>Title</span><input required maxLength={180} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Saturday mock-test clinic" /></label>
          <label><span>Message</span><textarea required maxLength={2000} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} placeholder="Give students the context, time and next action…" /></label>
          <label><span>Button destination</span><input value={form.actionUrl} onChange={(event) => setForm((current) => ({ ...current, actionUrl: event.target.value }))} placeholder="/mock-test" /></label>
          <button disabled={Boolean(busy)}>{busy === "announcement" ? <LoaderCircle className="spin" /> : <Send />} Send announcement</button>
        </form>
        <div className="communication-side">
          <article className="class-admin-panel automation-panel"><header><div><small>AUTOMATION ENGINE</small><h2>Scheduled reminders</h2><p>Classes, homework deadlines, weekend mocks, membership and passes, plus weekly progress reports.</p></div></header><div className="automation-status"><i className={snapshot.emailConfigured ? "ready" : "waiting"}>{snapshot.emailConfigured ? <ShieldCheck /> : <CircleAlert />}</i><span><b>{snapshot.emailConfigured ? "Email delivery connected" : "Email credentials required"}</b><small>{snapshot.emailConfigured ? "Provider events can update sent, delivered and opened states." : "In-app alerts work now. Add the verified email credentials to send externally."}</small></span></div><button onClick={() => void act("automation", { action: "run_automation" }, "Automation cycle complete.")} disabled={Boolean(busy)}>{busy === "automation" ? <LoaderCircle className="spin" /> : <RefreshCw />} Run reminder cycle now</button><button className="secondary" onClick={() => void act("retry", { action: "retry_failed" }, "Retry cycle complete.")} disabled={Boolean(busy)}><RotateCw /> Retry eligible email</button></article>
          <article className="class-admin-panel"><header><div><small>CONNECTED AUDIENCES</small><h2>Current reach</h2></div></header><div className="audience-summary"><span><GraduationCap /><b>{snapshot.students.length}</b><small>students</small></span><span><Users /><b>{snapshot.cohorts.length}</b><small>cohorts</small></span><span><Megaphone /><b>{snapshot.announcements.length}</b><small>announcements</small></span></div><Link className="communication-class-link" href="/creator/classes">Manage students and cohorts <ExternalLink /></Link></article>
        </div>
      </section>
      <section className="class-admin-panel communication-history"><header><div><small>DELIVERY HISTORY</small><h2>Every email attempt</h2><p>Provider webhooks update delivered and opened states; eligible failures retry automatically up to five times.</p></div></header><div className="class-admin-table"><table><thead><tr><th>Recipient</th><th>Message</th><th>Status</th><th>Attempts</th><th>Created</th><th>Sent / opened</th><th>Error</th></tr></thead><tbody>{snapshot.deliveries.map((delivery) => <tr key={delivery.id}><td>{delivery.userEmail}</td><td><b>{delivery.title}</b></td><td><span className={`delivery-status ${delivery.status}`}>{delivery.status.replaceAll("_", " ")}</span></td><td>{delivery.attempts}/5</td><td>{formatDate(delivery.createdAt)}</td><td>{delivery.openedAt ? `Opened ${formatDate(delivery.openedAt)}` : delivery.sentAt ? `Sent ${formatDate(delivery.sentAt)}` : "—"}</td><td>{delivery.lastError || "—"}</td></tr>)}{!snapshot.deliveries.length && <tr><td colSpan={7}>No delivery attempts yet.</td></tr>}</tbody></table></div></section>
      <section className="class-admin-panel communication-announcements"><header><div><small>ANNOUNCEMENT LOG</small><h2>Teacher broadcasts</h2></div></header><div>{snapshot.announcements.map((item) => <article key={item.id}><Megaphone /><span><b>{item.title}</b><p>{item.message}</p><small>{item.audienceType}{item.audienceValue ? ` · ${item.audienceValue}` : ""} · {item.recipientCount} recipients · {formatDate(item.sentAt)}</small></span></article>)}{!snapshot.announcements.length && <p>No teacher announcements yet.</p>}</div></section>
    </div>
  </main>;
}
