"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, BotMessageSquare, Check, Clock3, LoaderCircle, MessageSquareReply, RefreshCw, ShieldCheck } from "lucide-react";
import type { TutorEscalationView } from "../../../db/tutor";

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

export function CapyCoachSupportClient({ userName, initialEscalations }: { userName: string; initialEscalations: TutorEscalationView[] }) {
  const [items, setItems] = useState(initialEscalations);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | "refresh" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = useMemo(() => items.filter((item) => item.status === "pending"), [items]);
  const resolved = useMemo(() => items.filter((item) => item.status !== "pending"), [items]);

  const refresh = async () => {
    setBusy("refresh"); setError("");
    const response = await fetch("/api/creator/capi-coach").catch(() => null);
    const data = response ? await response.json().catch(() => null) as { escalations?: TutorEscalationView[]; error?: string } | null : null;
    if (response?.ok && data?.escalations) setItems(data.escalations); else setError(data?.error ?? "Could not refresh support requests.");
    setBusy(null);
  };

  const reply = async (id: number) => {
    const teacherReply = (replies[id] ?? "").trim();
    if (teacherReply.length < 2) return;
    setBusy(id); setError(""); setMessage("");
    const response = await fetch("/api/creator/capi-coach", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, reply: teacherReply }) }).catch(() => null);
    const data = response ? await response.json().catch(() => null) as { escalations?: TutorEscalationView[]; error?: string } | null : null;
    if (response?.ok && data?.escalations) {
      setItems(data.escalations); setReplies((current) => ({ ...current, [id]: "" })); setMessage("Your reply is now visible in the student’s Capy Coach conversation.");
    } else setError(data?.error ?? "The reply could not be sent.");
    setBusy(null);
  };

  return <main className="tutor-support-shell">
    <nav className="creator-topbar"><Link href="/creator"><ArrowLeft /> Creator Studio</Link><span><BotMessageSquare /> Capy Coach support</span><div><small>Teacher</small><b>{userName}</b></div></nav>
    <header className="tutor-support-hero"><div><span><ShieldCheck /> HUMAN-IN-THE-LOOP TUTORING</span><h1>Help Capy answer responsibly.</h1><p>Capy sends uncertain or sensitive questions here instead of inventing an answer. Your reply goes straight into the student’s saved tutor conversation.</p></div><aside><strong>{pending.length}<small>waiting for a teacher</small></strong><strong>{resolved.length}<small>resolved conversations</small></strong><button onClick={() => void refresh()} disabled={busy === "refresh"}>{busy === "refresh" ? <LoaderCircle className="spin" /> : <RefreshCw />} Refresh queue</button></aside></header>
    <div className="tutor-support-content">{message && <p className="creator-message"><Check /> {message}</p>}{error && <p className="creator-error">{error}</p>}
      <section><header><div><small>NEEDS REVIEW</small><h2>Student questions</h2></div><span>{pending.length} open</span></header><div className="tutor-support-list">{pending.map((item) => <article key={item.id}><header><div><b>{item.userEmail}</b><small><Clock3 /> {formatDate(item.createdAt)}</small></div><span>Waiting</span></header><blockquote>{item.question}</blockquote><p><b>Why Capy escalated:</b> {item.reason}</p><label><span>Your answer to the student</span><textarea maxLength={1500} value={replies[item.id] ?? ""} onChange={(event) => setReplies((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Give a clear explanation, confirm the rule, or point the student to the right lesson…" /></label><button disabled={busy !== null || !(replies[item.id] ?? "").trim()} onClick={() => void reply(item.id)}>{busy === item.id ? <LoaderCircle className="spin" /> : <MessageSquareReply />} Send teacher reply</button></article>)}{!pending.length && <div className="tutor-support-empty"><Check /><b>Everything is answered</b><p>Capy has no questions waiting for teacher review.</p></div>}</div></section>
      {resolved.length > 0 && <section><header><div><small>RESOLVED</small><h2>Recent teacher answers</h2></div></header><div className="tutor-resolved-list">{resolved.slice(0, 30).map((item) => <article key={item.id}><span><b>{item.userEmail}</b><small>{formatDate(item.resolvedAt)} · {item.resolvedBy}</small></span><p>{item.question}</p><blockquote>{item.teacherReply}</blockquote></article>)}</div></section>}
    </div>
  </main>;
}
