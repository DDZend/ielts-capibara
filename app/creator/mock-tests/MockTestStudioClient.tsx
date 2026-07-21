"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, BookOpenCheck, Check, ChevronRight, Clock3, Eye, EyeOff, FileStack, Gauge, Headphones, LoaderCircle, Mic2, PenLine, Plus, Save, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { MOCK_SKILLS, type MockSkill } from "../../../lib/mock-engine";

type LibraryItem = { ref: string; module: MockSkill; lessonTitle: string; title: string; prompt: string; type: string; hasAudio: boolean; published: boolean };
type Dashboard = {
  tests: Array<{ id: number; title: string; description: string; status: string; updated_at: string }>;
  versions: Array<{ id: number; testId: number; testTitle: string; label: string; status: string; itemCount: number; counts: Record<MockSkill, number>; readingMinutes: number; listeningMinutes: number; writingMinutes: number; speakingMinutes: number }>;
  attempts: Array<{ id: number; userEmail: string; userName: string; testTitle: string; versionLabel: string; overallBand: number | null; submittedAt: string | null; status: string; assessments: Array<{ itemKey: string; skill: MockSkill; aiBand: number | null; teacherBand: number | null; prompt: string; response: string; feedback: Record<string, unknown> }> }>;
  analytics: Array<{ skill: MockSkill; questionType: string; attempts: number; mistakes: number; difficultyPercent: number }>;
};

const skillIcons = { Reading: BookOpenCheck, Listening: Headphones, Writing: PenLine, Speaking: Mic2 };

export function MockTestStudioClient({ userName, initialDashboard, initialLibrary }: { userName: string; initialDashboard: Dashboard; initialLibrary: LibraryItem[] }) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeSkill, setActiveSkill] = useState<MockSkill>("Reading");
  const [tab, setTab] = useState<"builder" | "moderation" | "analytics">("builder");
  const [title, setTitle] = useState("Capy Weekend IELTS Mock");
  const [label, setLabel] = useState(`Version ${String.fromCharCode(65 + initialDashboard.versions.length)}`);
  const [description, setDescription] = useState("A complete four-skill weekend benchmark.");
  const [testId, setTestId] = useState<number | null>(initialDashboard.tests[0]?.id ?? null);
  const [durations, setDurations] = useState<Record<MockSkill, number>>({ Reading: 60, Listening: 40, Writing: 60, Speaking: 15 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState<{ attemptId: number; itemKey: string; band: number; comment: string } | null>(null);
  const skillLibrary = initialLibrary.filter((item) => item.module === activeSkill);
  const selectedItems = useMemo(() => selected.flatMap((ref) => initialLibrary.find((item) => item.ref === ref) ?? []), [selected, initialLibrary]);
  const counts = Object.fromEntries(MOCK_SKILLS.map((skill) => [skill, selectedItems.filter((item) => item.module === skill).length])) as Record<MockSkill, number>;

  const add = (ref: string) => setSelected((items) => items.includes(ref) ? items.filter((item) => item !== ref) : [...items, ref]);
  const move = (index: number, direction: -1 | 1) => setSelected((items) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const request = async (method: "POST" | "PATCH", body: Record<string, unknown>) => {
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/creator/mock-tests", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { dashboard?: Dashboard; error?: string };
      if (!response.ok || !data.dashboard) throw new Error(data.error ?? "Could not update mock tests.");
      setDashboard(data.dashboard); setMessage("Mock-test system updated.");
      return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update mock tests."); return false; }
    finally { setSaving(false); }
  };

  const saveVersion = async (status: "draft" | "published") => {
    const saved = await request("POST", { testId, title, label, description, status, durations, refs: selected });
    if (saved) { setSelected([]); setLabel(`Version ${String.fromCharCode(65 + dashboard.versions.length + 1)}`); }
  };

  return <main className="mock-studio-shell">
    <header className="mock-studio-topbar"><Link href="/teacher"><ArrowLeft /> Teacher workspace</Link><span><Sparkles /> Mock-Test Studio</span><div><small>Teacher</small><b>{userName}</b></div></header>
    <section className="mock-studio-hero"><div><span>ASSESSMENT ENGINE</span><h1>Build the exam. Measure the progress.</h1><p>Turn your question library into secure, timed IELTS mocks with rotating versions and teacher-controlled final bands.</p></div><aside><strong>{dashboard.versions.filter((item) => item.status === "published").length}<small>live versions</small></strong><strong>{dashboard.attempts.length}<small>submitted mocks</small></strong><strong>{initialLibrary.length}<small>library questions</small></strong></aside></section>
    <nav className="mock-studio-tabs">
      <button className={tab === "builder" ? "active" : ""} onClick={() => setTab("builder")}><FileStack /> Builder</button>
      <button className={tab === "moderation" ? "active" : ""} onClick={() => setTab("moderation")}><UsersRound /> AI moderation</button>
      <button className={tab === "analytics" ? "active" : ""} onClick={() => setTab("analytics")}><BarChart3 /> Difficulty analytics</button>
    </nav>
    {(message || error) && <p className={`mock-studio-message ${error ? "error" : ""}`}>{error || message}</p>}

    {tab === "builder" && <section className="mock-builder-grid">
      <div className="mock-library-panel">
        <header><div><small>QUESTION LIBRARY</small><h2>Select lesson exercises</h2></div><span>{selected.length} selected</span></header>
        <div className="mock-skill-tabs">{MOCK_SKILLS.map((skill) => { const Icon = skillIcons[skill]; return <button key={skill} className={activeSkill === skill ? "active" : ""} onClick={() => setActiveSkill(skill)}><Icon />{skill}<small>{initialLibrary.filter((item) => item.module === skill).length}</small></button>; })}</div>
        <div className="mock-library-list">{skillLibrary.length ? skillLibrary.map((item) => <button key={item.ref} className={selected.includes(item.ref) ? "selected" : ""} onClick={() => add(item.ref)}><i>{selected.includes(item.ref) ? <Check /> : <Plus />}</i><span><b>{item.title}</b><small>{item.lessonTitle} · {item.type.replaceAll("-", " ")}{item.module === "Listening" && !item.hasAudio ? " · transcript voice" : ""}</small><p>{item.prompt}</p></span></button>) : <div className="mock-library-empty"><BookOpenCheck /><b>No {activeSkill} questions yet</b><p>Add exercises to {activeSkill} lessons in Creator Studio first.</p></div>}</div>
      </div>
      <div className="mock-build-panel">
        <header><small>TEST BLUEPRINT</small><h2>Version and exam settings</h2><p>Complete IELTS recommendation: 40 Reading, 40 Listening, 2 Writing and 3 Speaking tasks.</p></header>
        <div className="mock-blueprint-fields">
          <label><span>Mock family</span><select value={testId ?? "new"} onChange={(event) => { const value = event.target.value; setTestId(value === "new" ? null : Number(value)); const test = dashboard.tests.find((entry) => entry.id === Number(value)); if (test) { setTitle(test.title); setDescription(test.description); } }}><option value="new">Create a new mock</option>{dashboard.tests.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}</select></label>
          <label><span>Test title</span><input value={title} maxLength={140} onChange={(event) => setTitle(event.target.value)} /></label>
          <label><span>Version label</span><input value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} /></label>
          <label className="wide"><span>Description</span><textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} /></label>
        </div>
        <div className="mock-blueprint-counts">{MOCK_SKILLS.map((skill) => { const Icon = skillIcons[skill]; const target = skill === "Reading" || skill === "Listening" ? 40 : skill === "Writing" ? 2 : 3; return <div key={skill} className={counts[skill] >= target ? "ready" : ""}><Icon /><span><b>{skill}</b><small>{counts[skill]} / {target} tasks</small></span><label><Clock3 /><input type="number" min={5} max={180} value={durations[skill]} onChange={(event) => setDurations((current) => ({ ...current, [skill]: Number(event.target.value) }))} /> min</label></div>; })}</div>
        <div className="mock-selected-order"><header><b>Exam order</b><span>Select and reorder questions</span></header>{selectedItems.map((item, index) => <div key={`${item.ref}-${index}`}><i>{index + 1}</i><span><b>{item.module} · {item.title}</b><small>{item.type.replaceAll("-", " ")}</small></span><button disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up"><ArrowUp /></button><button disabled={index === selected.length - 1} onClick={() => move(index, 1)} aria-label="Move down"><ArrowDown /></button><button className="remove" onClick={() => add(item.ref)} aria-label="Remove"><EyeOff /></button></div>)}</div>
        <footer><span><ShieldCheck /> Published tests always use secure exam mode.</span><button disabled={saving || !selected.length} onClick={() => void saveVersion("draft")}><Save /> Save draft</button><button className="primary" disabled={saving || MOCK_SKILLS.some((skill) => counts[skill] === 0)} onClick={() => void saveVersion("published")}>{saving ? <LoaderCircle className="spin" /> : <Eye />} Publish version</button></footer>
      </div>
      <aside className="mock-version-panel"><header><small>VERSIONS</small><h2>Rotation pool</h2></header>{dashboard.versions.map((version) => <article key={version.id}><div><span className={version.status}>{version.status}</span><b>{version.testTitle}</b><small>{version.label} · {version.itemCount} tasks</small></div><p>{MOCK_SKILLS.map((skill) => `${skill[0]} ${version.counts[skill]}`).join(" · ")}</p><button onClick={() => void request("PATCH", { action: "status", versionId: version.id, status: version.status === "published" ? "hidden" : "published" })}>{version.status === "published" ? <><EyeOff /> Hide</> : <><Eye /> Publish</>}</button></article>)}</aside>
    </section>}

    {tab === "moderation" && <section className="mock-moderation-panel"><header><div><small>TEACHER REVIEW</small><h2>Moderate AI band estimates</h2><p>Read the essay or transcript, listen to Speaking recordings, review AI feedback and make the final score yours.</p></div><Gauge /></header>{dashboard.attempts.length ? dashboard.attempts.map((attempt) => <article key={attempt.id}><div className="mock-attempt-heading"><span><b>{attempt.userName}</b><small>{attempt.userEmail}</small></span><span><b>{attempt.testTitle}</b><small>{attempt.versionLabel} · {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString() : "In review"}</small></span><strong>{attempt.overallBand?.toFixed(1) ?? "—"}<small>overall</small></strong></div><div className="mock-assessment-list">{attempt.assessments.map((assessment) => <div key={assessment.itemKey}><span><b>{assessment.skill}</b><small>AI {assessment.aiBand?.toFixed(1) ?? "—"}{assessment.teacherBand ? ` · Teacher ${assessment.teacherBand.toFixed(1)}` : ""}</small></span><details><summary>Open response</summary><div><b>Question</b><p>{assessment.prompt}</p><b>{assessment.skill === "Writing" ? "Student essay" : "Speaking transcript"}</b><p className="response-text">{assessment.response || "No response text available."}</p>{typeof assessment.feedback.summary === "string" && <><b>AI feedback</b><p>{assessment.feedback.summary}</p></>}</div></details>{assessment.skill === "Speaking" && <audio controls preload="none" src={`/api/mock-exams/recording?attemptId=${attempt.id}&itemKey=${encodeURIComponent(assessment.itemKey)}`} />}<button onClick={() => setReview({ attemptId: attempt.id, itemKey: assessment.itemKey, band: assessment.teacherBand ?? assessment.aiBand ?? 6, comment: "" })}>Review <ChevronRight /></button></div>)}</div></article>) : <p className="mock-empty-state">Submitted mocks will appear here for teacher moderation.</p>}</section>}

    {tab === "analytics" && <section className="mock-analytics-panel"><header><div><small>QUESTION-TYPE ANALYTICS</small><h2>Where students lose marks</h2><p>Difficulty is calculated from incorrect objective answers across submitted mocks.</p></div><BarChart3 /></header><div>{dashboard.analytics.length ? dashboard.analytics.map((row) => <article key={`${row.skill}-${row.questionType}`}><span><b>{row.skill}</b><small>{row.questionType.replaceAll("-", " ")}</small></span><div><i style={{ width: `${row.difficultyPercent}%` }} /></div><strong>{row.difficultyPercent}%<small>{row.mistakes}/{row.attempts} mistakes</small></strong></article>) : <p className="mock-empty-state">Analytics will grow after students submit objective questions.</p>}</div></section>}

    {review && <div className="mock-review-modal" role="dialog" aria-modal="true"><form onSubmit={(event) => { event.preventDefault(); void request("PATCH", { action: "moderate", ...review }).then((ok) => { if (ok) setReview(null); }); }}><header><span><Gauge /><b>Teacher moderation</b></span><button type="button" onClick={() => setReview(null)}>Close</button></header><label><span>Final half-band</span><select value={review.band} onChange={(event) => setReview((current) => current ? { ...current, band: Number(event.target.value) } : current)}>{Array.from({ length: 17 }, (_, index) => 1 + index * .5).map((band) => <option key={band} value={band}>{band.toFixed(1)}</option>)}</select></label><label><span>Comment for the student</span><textarea value={review.comment} maxLength={1000} onChange={(event) => setReview((current) => current ? { ...current, comment: event.target.value } : current)} placeholder="Explain the final score and next priority…" /></label><button className="primary" disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Check />} Confirm final band</button></form></div>}
  </main>;
}
