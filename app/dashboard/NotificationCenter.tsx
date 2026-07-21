"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, BookOpenCheck, CalendarClock, Check, CheckCheck, ChevronRight, CreditCard, Mail, Megaphone, Settings, ShieldAlert, Sparkles, Target, X } from "lucide-react";
import type { NotificationCategory, NotificationCenterSnapshot, NotificationPreferences } from "../../lib/notifications";

const categoryIcon: Record<NotificationCategory, typeof Bell> = {
  upcoming_class: CalendarClock,
  new_homework: BookOpenCheck,
  homework_deadline: ShieldAlert,
  teacher_comment: Megaphone,
  weekend_mock: Target,
  membership: CreditCard,
  sponsored_pass: Sparkles,
  weekly_report: Sparkles,
  announcement: Megaphone,
};

const preferenceOptions: Array<{ key: keyof NotificationPreferences; label: string; description: string }> = [
  { key: "upcomingClasses", label: "Upcoming classes", description: "Schedules and 24-hour reminders" },
  { key: "newHomework", label: "New homework", description: "Assignments from your teacher" },
  { key: "homeworkDeadlines", label: "Homework deadlines", description: "Due-within-24-hours alerts" },
  { key: "teacherComments", label: "Teacher comments", description: "Reviews and visible notes" },
  { key: "weekendMock", label: "Weekend mock", description: "Weekly test challenge" },
  { key: "membership", label: "Membership & payments", description: "Expiry and payment problems" },
  { key: "sponsoredPass", label: "Sponsored passes", description: "24-hour pass expiry" },
  { key: "weeklyReport", label: "Weekly report", description: "Your automatic progress summary" },
  { key: "announcements", label: "Teacher announcements", description: "Individual, cohort and school news" },
];

function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60); if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60); if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

export function NotificationCenter({ initialSnapshot }: { initialSnapshot: NotificationCenterSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"inbox" | "settings" | "delivery">("inbox");
  const [preferences, setPreferences] = useState(initialSnapshot.preferences);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    setBusy("refresh");
    const response = await fetch("/api/notifications").catch(() => null);
    const data = response ? await response.json().catch(() => null) as { snapshot?: NotificationCenterSnapshot } | null : null;
    if (data?.snapshot) { setSnapshot(data.snapshot); setPreferences(data.snapshot.preferences); }
    setBusy("");
  }

  async function patch(body: Record<string, unknown>) {
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = response ? await response.json().catch(() => null) as { snapshot?: NotificationCenterSnapshot; error?: string } | null : null;
    if (data?.snapshot) { setSnapshot(data.snapshot); setPreferences(data.snapshot.preferences); return true; }
    setMessage(data?.error || "The notification centre could not be updated."); return false;
  }

  async function markRead(id?: number) {
    setBusy(id ? `read-${id}` : "read-all");
    await patch({ action: id ? "read" : "read_all", notificationId: id });
    setBusy("");
  }

  async function savePreferences() {
    setBusy("preferences"); setMessage("");
    if (await patch({ action: "preferences", preferences })) setMessage("Notification preferences saved.");
    setBusy("");
  }

  return <div className="notification-control-wrap">
    <button className="notification interactive-control" aria-label={`Open notifications. ${snapshot.unreadCount} unread`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { const next = !open; setOpen(next); if (next) void refresh(); }}>
      <Bell />{snapshot.unreadCount > 0 && <i>{snapshot.unreadCount > 9 ? "9+" : snapshot.unreadCount}</i>}
    </button>
    {open && <section className="notification-popover" role="dialog" aria-label="Notifications">
      <header className="notification-popover-head"><div><span>COMMUNICATION CENTRE</span><h2>{view === "inbox" ? "Notifications" : view === "settings" ? "Your preferences" : "Email history"}</h2></div><button onClick={() => setOpen(false)} aria-label="Close notifications"><X /></button></header>
      <nav className="notification-tabs">
        <button className={view === "inbox" ? "active" : ""} onClick={() => setView("inbox")}><Bell /> Inbox{snapshot.unreadCount ? <i>{snapshot.unreadCount}</i> : null}</button>
        <button className={view === "delivery" ? "active" : ""} onClick={() => setView("delivery")}><Mail /> Email</button>
        <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><Settings /> Settings</button>
      </nav>
      {message && <p className="notification-message"><Check /> {message}</p>}
      {view === "inbox" && <>
        <div className="notification-inbox-actions"><span>{snapshot.unreadCount ? `${snapshot.unreadCount} unread` : "You are all caught up"}</span>{snapshot.unreadCount > 0 && <button disabled={busy === "read-all"} onClick={() => void markRead()}><CheckCheck /> Mark all read</button>}</div>
        <div className="notification-list">
          {snapshot.notifications.length ? snapshot.notifications.map((item) => { const Icon = categoryIcon[item.category] ?? Bell; return <article className={item.status === "unread" ? "unread" : ""} key={item.id}>
            <span className={`notification-type ${item.category}`}><Icon /></span><div><small>{item.category.replaceAll("_", " ")} · {relativeTime(item.createdAt)}</small><b>{item.title}</b><p>{item.message}</p>{item.actionUrl && <Link href={item.actionUrl} onClick={() => void markRead(item.id)}>Open <ChevronRight /></Link>}</div>{item.status === "unread" && <button className="read-dot" disabled={busy === `read-${item.id}`} onClick={() => void markRead(item.id)} aria-label={`Mark ${item.title} read`} />}
          </article>; }) : <div className="notification-empty"><CheckCheck /><b>No notifications yet</b><p>Class reminders, homework, teacher comments and reports will appear here.</p></div>}
        </div>
      </>}
      {view === "delivery" && <div className="notification-delivery-view">
        {!snapshot.emailConfigured && <aside><ShieldAlert /><div><b>Email needs one final connection</b><p>In-platform alerts are active. The school owner needs to add the verified email provider credentials before outbound email can send.</p></div></aside>}
        <div className="notification-delivery-list">{snapshot.deliveries.length ? snapshot.deliveries.map((delivery) => <article key={delivery.id}><Mail /><div><b>{delivery.title}</b><small>{relativeTime(delivery.createdAt)} · {delivery.attempts} attempt{delivery.attempts === 1 ? "" : "s"}</small></div><span className={delivery.status}>{delivery.status.replaceAll("_", " ")}</span></article>) : <div className="notification-empty"><Mail /><b>No email history yet</b><p>Your next eligible notification will appear here.</p></div>}</div>
      </div>}
      {view === "settings" && <div className="notification-settings">
        <section><h3>Delivery channels</h3><label><span><b>In-platform inbox</b><small>Keep a searchable notification history</small></span><input type="checkbox" checked={preferences.inAppEnabled} onChange={(event) => setPreferences((current) => ({ ...current, inAppEnabled: event.target.checked }))} /></label><label><span><b>Email notifications</b><small>Receive important alerts away from the platform</small></span><input type="checkbox" checked={preferences.emailEnabled} onChange={(event) => setPreferences((current) => ({ ...current, emailEnabled: event.target.checked }))} /></label></section>
        <section><h3>What you receive</h3>{preferenceOptions.map((option) => <label key={option.key}><span><b>{option.label}</b><small>{option.description}</small></span><input type="checkbox" checked={Boolean(preferences[option.key])} onChange={(event) => setPreferences((current) => ({ ...current, [option.key]: event.target.checked }))} /></label>)}</section>
        <section><h3>Quiet hours</h3><p>Email waits until quiet hours finish. Urgent alerts remain safely in your inbox.</p><div className="quiet-hours"><label><span>From</span><input type="time" value={preferences.quietStart} onChange={(event) => setPreferences((current) => ({ ...current, quietStart: event.target.value }))} /></label><label><span>Until</span><input type="time" value={preferences.quietEnd} onChange={(event) => setPreferences((current) => ({ ...current, quietEnd: event.target.value }))} /></label></div><select value={preferences.timezone} onChange={(event) => setPreferences((current) => ({ ...current, timezone: event.target.value }))}><option value="Asia/Almaty">Almaty / Astana</option><option value="Asia/Qyzylorda">Qyzylorda</option><option value="Europe/Moscow">Moscow</option><option value="UTC">UTC</option></select></section>
        <button className="save-notification-settings" disabled={busy === "preferences"} onClick={() => void savePreferences()}>{busy === "preferences" ? "Saving…" : "Save preferences"}</button>
        <div className="future-channels"><span>COMING LATER</span><b>WhatsApp and Telegram</b><p>The delivery model is ready for extra channels once business accounts are connected.</p></div>
      </div>}
    </section>}
  </div>;
}
