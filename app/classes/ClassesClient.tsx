"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, BellRing, BookOpenCheck, CalendarDays, Check, CircleAlert, Clock3, ExternalLink, GraduationCap, LoaderCircle, MessageSquareText, RefreshCw, ShieldCheck, Sparkles, UserRoundCheck, Users, Video, X } from "lucide-react";
import type { StudentClassSnapshot } from "../../db/classes";
import { billingPlanLabel } from "../../lib/billing-config";

const formatDate = (value: string) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function ClassesClient({ userName, initialSnapshot }: { userName: string; initialSnapshot: StudentClassSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reschedule, setReschedule] = useState<number | null>(null);
  const [homeworkNotes, setHomeworkNotes] = useState<Record<number, string>>({});
  const firstName = userName.split(/[\s@]/)[0] || "Student";

  const act = async (name: string, payload: Record<string, unknown>, success: string) => {
    setBusy(name); setMessage(""); setError("");
    try {
      const response = await fetch("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { snapshot?: StudentClassSnapshot; error?: string };
      if (!response.ok || !data.snapshot) throw new Error(data.error ?? "The class action could not be completed.");
      setSnapshot(data.snapshot); setMessage(success); setReschedule(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The class action could not be completed."); }
    finally { setBusy(""); }
  };
  const refresh = async () => {
    setBusy("refresh"); const response = await fetch("/api/classes").catch(() => null); const data = response ? await response.json().catch(() => null) as { snapshot?: StudentClassSnapshot; error?: string } | null : null;
    if (response?.ok && data?.snapshot) { setSnapshot(data.snapshot); setMessage("Your class schedule is up to date."); setError(""); } else setError(data?.error ?? "Could not refresh classes."); setBusy("");
  };

  return <main className="classes-shell">
    <header className="classes-topbar"><Link href="/dashboard"><ArrowLeft /> Dashboard</Link><Link className="billing-brand" href="/"><img src="/capi-profile.png" alt="" /><span><b>IELTS</b> Mastery</span></Link><span><ShieldCheck /> Private class space</span></header>
    <section className="classes-hero"><div><span><Sparkles /> CLASSES & HOMEWORK</span><h1>{firstName}, your teacher support is organised here.</h1><p>Book the meetings included in your membership, reschedule responsibly, join lessons and keep teacher-assigned work in one clear timeline.</p><div><BadgeCheck /><span><small>{billingPlanLabel(snapshot.allowance.planInterval ?? "").toUpperCase()}</small><b>{snapshot.allowance.label}</b></span></div></div><aside><img src="/capi-plan.png" alt="Capi Coach organising an IELTS study schedule" /><strong>{snapshot.allowance.remainingThisWeek}<small>meetings remaining this week</small></strong></aside></section>
    <div className="classes-page">
      {(message || error) && <p className={`classes-message ${error ? "error" : "success"}`}>{error ? <CircleAlert /> : <Check />}{error || message}<button onClick={() => { setError(""); setMessage(""); }}><X /></button></p>}
      <section className="classes-status-grid"><article><CalendarDays /><span><small>THIS WEEK</small><b>{snapshot.allowance.bookedThisWeek} of {snapshot.allowance.weeklyLimit} booked</b><p>{snapshot.allowance.weeklyLimit ? `${snapshot.allowance.remainingThisWeek} meeting slots are still available.` : "Upgrade to Gold or Platinum for teacher meetings."}</p></span></article><article><UserRoundCheck /><span><small>YOUR TEACHER</small><b>{snapshot.assignedTeacher?.displayName ?? "Not assigned yet"}</b><p>{snapshot.assignedTeacher ? snapshot.assignedTeacher.email : "Your teacher will appear here after assignment."}</p></span></article><article><BookOpenCheck /><span><small>HOMEWORK</small><b>{snapshot.homework.filter((item) => !["completed"].includes(item.status)).length} active tasks</b><p>Teacher feedback stays attached to each assignment.</p></span></article><button onClick={() => void refresh()} disabled={Boolean(busy)}>{busy === "refresh" ? <LoaderCircle className="spin" /> : <RefreshCw />} Refresh</button></section>

      {snapshot.reminders.length > 0 && <section className="classes-reminders"><header><BellRing /><div><small>UPCOMING REMINDERS</small><h2>Be ready for your next class</h2></div></header>{snapshot.reminders.map((reminder) => <div key={reminder.sessionId}><Clock3 /><span><b>{reminder.title}</b><small>{reminder.message} · {formatDate(reminder.startsAt)}</small></span></div>)}</section>}

      <section className="classes-grid"><article className="classes-panel"><header><div><small>YOUR BOOKINGS</small><h2>Upcoming classes</h2><p>Meeting links stay available here. Cancellations inside 24 hours are marked as late.</p></div></header><div className="student-class-list">{snapshot.upcoming.map((item) => <article key={item.id}><span className={`student-class-type ${item.sessionType}`}><Video /></span><div><small>{item.sessionType.toUpperCase()} · {item.meetingProvider}</small><h3>{item.title}</h3><p>{formatDate(item.startsAt)} · {item.teacherName}</p>{reschedule === item.id && <div className="reschedule-options"><span>Choose a replacement:</span>{snapshot.available.filter((option) => option.sessionType === item.sessionType).map((option) => <button onClick={() => void act(`reschedule-${item.id}`, { action: "reschedule", fromSessionId: item.id, toSessionId: option.id }, "Your class was rescheduled.")} key={option.id}>{formatDate(option.startsAt)} · {option.teacherName}</button>)}{!snapshot.available.some((option) => option.sessionType === item.sessionType) && <small>No replacement slots are currently open.</small>}</div>}</div><aside><a href={item.meetingUrl} target="_blank" rel="noreferrer"><ExternalLink /> Join class</a><button onClick={() => setReschedule((current) => current === item.id ? null : item.id)}><RefreshCw /> Reschedule</button><button className="cancel" onClick={() => { const reason = window.prompt("Why are you cancelling?"); if (reason) void act(`cancel-${item.id}`, { action: "cancel", sessionId: item.id, reason }, "Booking cancelled and recorded."); }}><X /> Cancel</button></aside></article>)}{!snapshot.upcoming.length && <div className="classes-empty"><CalendarDays /><b>No upcoming bookings</b><p>Choose an available class below when your membership includes meetings.</p></div>}</div></article>

        <article className="classes-panel"><header><div><small>BOOK A CLASS</small><h2>Available teacher slots</h2><p>The platform shows only the class type, cohort and teacher allowed by your package.</p></div></header><div className="available-class-list">{snapshot.available.map((item) => <article key={item.id}><div><span className={item.sessionType}>{item.sessionType === "group" ? <Users /> : <GraduationCap />}</span><div><b>{item.title}</b><small>{formatDate(item.startsAt)} · {item.teacherName}</small><p>{item.sessionType === "group" ? `${item.cohortName} · ${item.bookedCount}/${item.capacity} booked` : "Private individual lesson"}</p></div></div><button disabled={Boolean(busy) || snapshot.allowance.remainingThisWeek <= 0} onClick={() => void act(`book-${item.id}`, { action: "book", sessionId: item.id }, "Class booked. Your reminder and meeting link are ready.")}>{busy === `book-${item.id}` ? <LoaderCircle className="spin" /> : <>Book class <ArrowRight /></>}</button></article>)}{!snapshot.available.length && <div className="classes-empty"><Clock3 /><b>No matching slots available</b><p>{snapshot.allowance.weeklyLimit ? "Your teacher will add more suitable times soon." : "Silver and Starter access are platform-only. Gold includes group classes; Platinum includes individual classes."}</p><Link href="/billing">View membership options <ArrowRight /></Link></div>}</div></article></section>

      <section className="classes-grid classes-homework-grid"><article className="classes-panel"><header><div><small>ASSIGNED LEARNING</small><h2>Homework</h2><p>Open the linked lesson or exercise, then leave a submission note for your teacher.</p></div></header><div className="student-homework-list">{snapshot.homework.map((item) => <article key={item.id}><header><span><BookOpenCheck /></span><div><small>{item.module} · DUE {formatDate(item.dueAt)}</small><h3>{item.title}</h3></div><em className={`admin-status ${item.status}`}>{item.status.replaceAll("_", " ")}</em></header><p>{item.instructions}</p>{item.teacherComment && <blockquote><MessageSquareText /><span><b>Teacher feedback</b>{item.teacherComment}</span></blockquote>}{item.lessonId && <Link href={`/${item.module.toLowerCase()}?lesson=${encodeURIComponent(item.lessonId)}`}>Open lesson <ExternalLink /></Link>}<textarea value={homeworkNotes[item.id] ?? item.studentNote ?? ""} onChange={(event) => setHomeworkNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Add your response, link, or note for the teacher…" /><button disabled={Boolean(busy) || !String(homeworkNotes[item.id] ?? item.studentNote ?? "").trim()} onClick={() => void act(`homework-${item.id}`, { action: "submit_homework", assignmentId: item.id, studentNote: homeworkNotes[item.id] ?? item.studentNote }, "Homework submitted to your teacher.")}>{busy === `homework-${item.id}` ? <LoaderCircle className="spin" /> : <><Check /> Submit homework</>}</button></article>)}{!snapshot.homework.length && <div className="classes-empty"><BookOpenCheck /><b>No homework assigned</b><p>Your teacher’s lesson and exercise assignments will appear here.</p></div>}</div></article>

        <article className="classes-panel"><header><div><small>TEACHER COMMENTS</small><h2>Feedback timeline</h2><p>Only comments shared with you appear here. Private teaching notes remain private.</p></div></header><div className="student-comments-list">{snapshot.comments.map((item) => <div key={item.id}><i><MessageSquareText /></i><span><b>{item.teacherName}</b><p>{item.body}</p><small>{formatDate(item.createdAt)}</small></span></div>)}{!snapshot.comments.length && <div className="classes-empty"><MessageSquareText /><b>No shared comments yet</b><p>Personal feedback from your teacher will remain collected here.</p></div>}</div></article></section>
    </div>
  </main>;
}
