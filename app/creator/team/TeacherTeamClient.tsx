"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Check, CircleAlert, Clock3, LoaderCircle, MailPlus, ShieldCheck, UserCog, UserRoundCheck, UserRoundX, Users } from "lucide-react";
import type { StaffAccess, TeacherAccessRequest } from "../../../db/staff";
import { CREATOR_PERMISSION_DETAILS, CREATOR_PERMISSIONS, DEFAULT_TEACHER_PERMISSIONS, type CreatorPermission } from "../../../lib/staff-roles";

type Snapshot = { staff: StaffAccess[]; requests: TeacherAccessRequest[] };

export function TeacherTeamClient({ userName, initialSnapshot }: { userName: string; initialSnapshot: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [permissions, setPermissions] = useState<CreatorPermission[]>(DEFAULT_TEACHER_PERMISSIONS);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const call = async (method: "POST" | "PATCH", body: Record<string, unknown>, key: string) => {
    setSaving(key);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/creator/team", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { snapshot?: Snapshot; error?: string };
      if (!response.ok || !data.snapshot) throw new Error(data.error ?? "Could not update the teacher team.");
      setSnapshot(data.snapshot);
      setMessage(method === "POST" ? "Teacher invitation is ready. They will be activated after signing in with this email." : "Teacher access updated.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the teacher team.");
      return false;
    } finally {
      setSaving("");
    }
  };

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    if (await call("POST", { email, displayName, permissions }, "invite")) {
      setEmail("");
      setDisplayName("");
      setPermissions(DEFAULT_TEACHER_PERMISSIONS);
    }
  };

  const togglePermission = async (teacher: StaffAccess, permission: CreatorPermission) => {
    const next = teacher.permissions.includes(permission) ? teacher.permissions.filter((item) => item !== permission) : [...teacher.permissions, permission];
    await call("PATCH", { action: "update_teacher", email: teacher.email, permissions: next, status: teacher.status }, `${teacher.email}:${permission}`);
  };

  const pending = snapshot.requests.filter((request) => request.status === "pending");
  const activeCount = snapshot.staff.filter((staff) => staff.status === "active").length;

  return (
    <main className="team-admin-shell">
      <header className="team-admin-topbar"><Link href="/teacher"><ArrowLeft /> Teacher workspace</Link><span><ShieldCheck /> Owner controls</span><div><small>Signed in as</small><b>{userName}</b></div></header>
      <section className="team-admin-hero"><div><span><UserCog /> TEACHER TEAM</span><h1>Give every teacher exactly the right access.</h1><p>Invite teachers by email, review access requests, pause accounts instantly, and keep private student and business areas protected.</p></div><aside><strong>{activeCount}<small>active staff</small></strong><strong>{pending.length}<small>requests waiting</small></strong></aside></section>

      <section className="team-admin-page">
        {(message || error) && <p className={`team-admin-message ${error ? "error" : ""}`}>{error ? <CircleAlert /> : <Check />}{error || message}</p>}
        <div className="team-admin-grid">
          <form className="team-invite-card" onSubmit={(event) => void invite(event)}>
            <header><MailPlus /><div><small>INVITE A TEACHER</small><h2>Pre-approve their account</h2><p>Use the exact email they will use to sign in.</p></div></header>
            <div><label><span>Full name</span><input value={displayName} maxLength={100} onChange={(event) => setDisplayName(event.target.value)} placeholder="Aruzhan Teacher" /></label><label><span>Email address</span><input required type="email" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} placeholder="teacher@example.com" /></label></div>
            <fieldset><legend>Workspace permissions</legend>{CREATOR_PERMISSIONS.map((permission) => <label key={permission}><input type="checkbox" checked={permissions.includes(permission)} onChange={() => setPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission])} /><span><b>{CREATOR_PERMISSION_DETAILS[permission].label}</b><small>{CREATOR_PERMISSION_DETAILS[permission].description}</small></span></label>)}</fieldset>
            <button disabled={saving === "invite"}>{saving === "invite" ? <LoaderCircle className="spin" /> : <MailPlus />} Create teacher invitation</button>
          </form>

          <section className="team-request-card"><header><Clock3 /><div><small>ACCESS REQUESTS</small><h2>Waiting for your review</h2><p>Approve only people you recognise as teachers.</p></div></header><div className="team-request-list">{pending.length === 0 ? <p><ShieldCheck /> No requests are waiting.</p> : pending.map((request) => <article key={request.id}><span><b>{request.displayName}</b><small>{request.email}</small><p>{request.message || "No note was included."}</p></span><div><button disabled={Boolean(saving)} onClick={() => void call("PATCH", { action: "review_request", email: request.email, decision: "approved", permissions: DEFAULT_TEACHER_PERMISSIONS }, `approve:${request.email}`)}>{saving === `approve:${request.email}` ? <LoaderCircle className="spin" /> : <UserRoundCheck />} Approve</button><button className="danger" disabled={Boolean(saving)} onClick={() => void call("PATCH", { action: "review_request", email: request.email, decision: "declined" }, `decline:${request.email}`)}><UserRoundX /> Decline</button></div></article>)}</div></section>
        </div>

        <section className="team-roster-card"><header><div><small>STAFF DIRECTORY</small><h2>Teacher roles and permissions</h2><p>Changes take effect on the next page request.</p></div><span><Users /> {snapshot.staff.length} accounts</span></header><div className="team-roster-table"><table><thead><tr><th>Account</th><th>Role & status</th><th>Permissions</th><th>Account control</th></tr></thead><tbody>{snapshot.staff.map((teacher) => <tr key={teacher.email}><td><b>{teacher.displayName}</b><small>{teacher.email}</small></td><td><em className={teacher.role}>{teacher.role}</em><i className={teacher.status}>{teacher.status}</i></td><td><div className="team-permission-pills">{CREATOR_PERMISSIONS.map((permission) => <button key={permission} disabled={teacher.role === "owner" || Boolean(saving)} className={teacher.permissions.includes(permission) ? "enabled" : ""} title={CREATOR_PERMISSION_DETAILS[permission].description} onClick={() => void togglePermission(teacher, permission)}>{teacher.permissions.includes(permission) && <Check />}{CREATOR_PERMISSION_DETAILS[permission].label}</button>)}</div></td><td>{teacher.role === "owner" ? <span className="owner-lock"><ShieldCheck /> Protected owner</span> : <button className={`team-status-toggle ${teacher.status === "active" ? "danger" : ""}`} disabled={Boolean(saving)} onClick={() => void call("PATCH", { action: "update_teacher", email: teacher.email, status: teacher.status === "active" ? "inactive" : "active", permissions: teacher.permissions }, `status:${teacher.email}`)}>{teacher.status === "active" ? <UserRoundX /> : <UserRoundCheck />}{teacher.status === "active" ? "Deactivate" : "Activate"}</button>}</td></tr>)}</tbody></table></div></section>
      </section>
    </main>
  );
}
