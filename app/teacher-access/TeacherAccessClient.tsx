"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, LoaderCircle, Send, ShieldAlert } from "lucide-react";
import type { TeacherAccessRequest } from "../../db/staff";

export function TeacherAccessClient({ email, reason, initialRequest }: { email: string; reason: string; initialRequest: TeacherAccessRequest | null }) {
  const [request, setRequest] = useState(initialRequest);
  const [message, setMessage] = useState(initialRequest?.message ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/teacher-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json() as { request?: TeacherAccessRequest; error?: string };
      if (!response.ok || !data.request) throw new Error(data.error ?? "Could not send your request.");
      setRequest(data.request);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send your request.");
    } finally {
      setSaving(false);
    }
  };

  const inactive = reason === "inactive";
  const permission = reason === "permission" || reason === "owner";
  const pending = request?.status === "pending";

  return (
    <main className="teacher-access-shell">
      <section className="teacher-access-card">
        <div className={`teacher-access-icon ${pending ? "pending" : ""}`}>{pending ? <Clock3 /> : permission ? <ShieldAlert /> : <ShieldAlert />}</div>
        <small>TEACHER WORKSPACE</small>
        <h1>{pending ? "Your request is waiting for review" : inactive ? "This teacher account is inactive" : permission ? "This area needs another permission" : "Teacher approval is required"}</h1>
        <p>{pending ? "The school owner can now review your request. You can keep using the student dashboard while you wait." : inactive ? "Ask the school owner to reactivate your account. Your student dashboard is still available." : permission ? "Your teacher account is active, but the owner has not enabled this area for your role." : "Teacher tools contain private student and business information, so the school owner must approve every teacher account."}</p>
        <div className="teacher-access-email"><span><small>Current account</small><b>{email}</b></span><CheckCircle2 /></div>

        {!inactive && !permission && !pending && <div className="teacher-request-form">
          <label><span>Optional note for the owner</span><textarea maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="For example: I teach the September Band 7.0 group." /></label>
          {error && <p>{error}</p>}
          <button type="button" disabled={saving} onClick={() => void submit()}>{saving ? <LoaderCircle className="spin" /> : <Send />} Request teacher access</button>
        </div>}

        <div className="teacher-access-actions"><Link href="/dashboard"><ArrowLeft /> Go to student dashboard</Link><Link href="/login">Choose another workspace</Link></div>
      </section>
    </main>
  );
}
