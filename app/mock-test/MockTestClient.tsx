"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, BookOpenCheck, Check, CheckCircle2, ChevronLeft, Clock3, Cloud, CloudOff, FileWarning, Headphones, LoaderCircle, LockKeyhole, Mic2, PenLine, Play, ShieldCheck, Sparkles, Square, Target, TimerReset, Trophy } from "lucide-react";
import { MOCK_SKILLS, type MockAttemptSummary, type MockExamItem, type StudentMockAttempt, type StudentMockSnapshot } from "../../lib/mock-engine";

const icons = { Reading: BookOpenCheck, Listening: Headphones, Writing: PenLine, Speaking: Mic2 };

function recoveredSeconds(attempt: StudentMockAttempt | null) {
  if (!attempt) return 0;
  const skill = attempt.items[attempt.currentItemIndex]?.skill ?? attempt.currentSection;
  const elapsed = Math.floor((Date.now() - new Date(attempt.sectionStartedAt).getTime()) / 1000);
  return Math.max(0, attempt.durations[skill] * 60 - elapsed);
}

export function MockTestClient({ initialSnapshot, userName }: { initialSnapshot: StudentMockSnapshot; userName: string }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [attempt, setAttempt] = useState<StudentMockAttempt | null>(initialSnapshot.activeAttempt);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialSnapshot.activeAttempt?.answers ?? {});
  const [currentIndex, setCurrentIndex] = useState(initialSnapshot.activeAttempt?.currentItemIndex ?? 0);
  const [remaining, setRemaining] = useState(() => recoveredSeconds(initialSnapshot.activeAttempt));
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "offline">("saved");
  const [error, setError] = useState("");
  const [listeningPlayed, setListeningPlayed] = useState<Record<string, boolean>>({});
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [assessingKey, setAssessingKey] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeItem = attempt?.items[currentIndex] ?? null;
  const currentSkill = activeItem?.skill ?? attempt?.currentSection ?? "Reading";

  const sectionStart = attempt?.items.findIndex((item) => item.skill === currentSkill) ?? 0;
  const sectionEnd = attempt ? attempt.items.reduce((last, item, index) => item.skill === currentSkill ? index : last, sectionStart) : 0;
  const sectionNumber = activeItem ? attempt!.items.slice(sectionStart, currentIndex + 1).filter((item) => item.skill === currentSkill).length : 0;
  const sectionTotal = attempt?.items.filter((item) => item.skill === currentSkill).length ?? 0;
  const listeningKey = activeItem ? `${activeItem.lessonId}:${activeItem.audioMediaId ?? "script"}` : "";

  useEffect(() => {
    if (!attempt || remaining <= 0) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [attempt, remaining]);

  useEffect(() => {
    const online = () => { setSaveState("saving"); setAnswers((current) => ({ ...current })); };
    const offline = () => setSaveState("offline");
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  const saveNow = useCallback(async (nextIndex = currentIndex, nextAnswers = answers) => {
    if (!attempt || !attempt.items[nextIndex]) return null;
    if (!navigator.onLine) { setSaveState("offline"); return null; }
    setSaveState("saving");
    const response = await fetch("/api/mock-exams", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "autosave", attemptId: attempt.id, answers: nextAnswers, currentItemIndex: nextIndex, currentSection: attempt.items[nextIndex].skill }),
    }).catch(() => null);
    if (!response?.ok) { setSaveState("offline"); return null; }
    const data = await response.json() as { savedAt: string; sectionStartedAt: string };
    setSaveState("saved");
    if (data.sectionStartedAt !== attempt.sectionStartedAt) {
      setRemaining(attempt.durations[attempt.items[nextIndex].skill] * 60);
      setAttempt((current) => current ? { ...current, sectionStartedAt: data.sectionStartedAt, currentSection: current.items[nextIndex].skill, currentItemIndex: nextIndex, answers: nextAnswers } : current);
    }
    return data;
  }, [answers, attempt, currentIndex]);

  useEffect(() => {
    if (!attempt) return;
    const timer = setTimeout(() => { void saveNow(); }, 1200);
    return () => clearTimeout(timer);
  }, [answers, currentIndex, attempt, saveNow]);

  useEffect(() => () => {
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    window.speechSynthesis?.cancel();
  }, []);

  const start = async () => {
    setSaving(true); setError("");
    const response = await fetch("/api/mock-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) }).catch(() => null);
    const data = response ? await response.json() as { attempt?: StudentMockAttempt; error?: string } : { error: "You appear to be offline." };
    if (!response?.ok || !data.attempt) setError(data.error ?? "Could not start the mock.");
    else { setAttempt(data.attempt); setAnswers(data.attempt.answers); setCurrentIndex(data.attempt.currentItemIndex); setRemaining(recoveredSeconds(data.attempt)); }
    setSaving(false);
  };

  const updateAnswer = (value: unknown) => activeItem && setAnswers((current) => ({ ...current, [activeItem.key]: value }));

  const playListening = () => {
    if (!activeItem || listeningPlayed[listeningKey]) return;
    setListeningPlayed((current) => ({ ...current, [listeningKey]: true }));
    if (activeItem.audioMediaId) {
      const audio = new Audio(`/api/media/${activeItem.audioMediaId}`);
      void audio.play().catch(() => setError("The listening audio could not start."));
    } else {
      const speech = new SpeechSynthesisUtterance(activeItem.listeningScript);
      speech.lang = "en-GB"; speech.rate = .9;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(speech);
    }
  };

  const assessWriting = async () => {
    if (!attempt || !activeItem) return;
    const essay = String(answers[activeItem.key] ?? "");
    setAssessingKey(activeItem.key); setError(""); await saveNow();
    const response = await fetch("/api/mock-exams/writing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId: attempt.id, itemKey: activeItem.key, essay }) }).catch(() => null);
    const data = response ? await response.json() as { complete?: boolean; band?: number; error?: string } : { error: "You appear to be offline." };
    if (!response?.ok || !data.complete) setError(data.error ?? "Could not assess this writing.");
    else setAttempt((current) => current ? { ...current, assessments: { ...current.assessments, [activeItem.key]: { aiBand: data.band ?? null, teacherBand: null, complete: true } } } : current);
    setAssessingKey("");
  };

  const uploadRecording = useCallback(async (blob: Blob, item: MockExamItem) => {
    if (!attempt) return;
    setAssessingKey(item.key); setError("");
    const form = new FormData(); form.set("attemptId", String(attempt.id)); form.set("itemKey", item.key); form.set("audio", blob, "speaking-answer.webm");
    const response = await fetch("/api/mock-exams/speaking", { method: "POST", body: form }).catch(() => null);
    const data = response ? await response.json() as { complete?: boolean; band?: number; error?: string } : { error: "You appear to be offline." };
    if (!response?.ok || !data.complete) setError(data.error ?? "Could not assess this recording.");
    else setAttempt((current) => current ? { ...current, assessments: { ...current.assessments, [item.key]: { aiBand: data.band ?? null, teacherBand: null, complete: true } } } : current);
    setAssessingKey("");
  }, [attempt]);

  const stopRecording = useCallback(() => {
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    recordingTimer.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }, []);

  const startRecording = async () => {
    if (!activeItem) return;
    try {
      const item = activeItem;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream); chunksRef.current = []; recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); void uploadRecording(blob, item); };
      recorder.start(); setRecording(true); setRecordingSeconds(0);
      const limit = item.recordingSeconds ?? 120;
      recordingTimer.current = setInterval(() => setRecordingSeconds((seconds) => { if (seconds + 1 >= limit) queueMicrotask(stopRecording); return Math.min(limit, seconds + 1); }), 1000);
    } catch { setError("Microphone access is required for the Speaking mock."); }
  };

  const answered = (item: MockExamItem) => {
    if (item.skill === "Speaking") return Boolean(attempt?.assessments[item.key]?.complete);
    if (item.skill === "Writing") return String(answers[item.key] ?? "").trim().split(/\s+/).filter(Boolean).length >= 40 && Boolean(attempt?.assessments[item.key]?.complete);
    const value = answers[item.key];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value).length > 0;
    return String(value ?? "").trim().length > 0;
  };

  const goTo = async (index: number) => {
    if (!attempt || !attempt.items[index]) return;
    await saveNow(index, answers);
    setCurrentIndex(index); setAttempt((current) => current ? { ...current, currentItemIndex: index, currentSection: current.items[index].skill, answers } : current);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = async () => {
    if (!attempt || !activeItem) return;
    if (!answered(activeItem) && remaining > 0) { setError("Complete and save this question before continuing."); return; }
    setError("");
    if (currentIndex < attempt.items.length - 1) await goTo(currentIndex + 1);
    else {
      setSaving(true); await saveNow();
      const response = await fetch("/api/mock-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", attemptId: attempt.id }) }).catch(() => null);
      const data = response ? await response.json() as StudentMockSnapshot & { error?: string } : { error: "You appear to be offline." };
      if (!response?.ok || data.error) setError(data.error ?? "Could not submit the mock.");
      else { setSnapshot(data as StudentMockSnapshot); setAttempt(null); setAnswers({}); }
      setSaving(false);
    }
  };

  const skipExpiredSection = async () => {
    if (!attempt) return;
    const nextIndex = attempt.items.findIndex((item, index) => index > sectionEnd && item.skill !== currentSkill);
    if (nextIndex >= 0) await goTo(nextIndex); else await next();
  };

  if (!attempt) return <MockLanding snapshot={snapshot} userName={userName} saving={saving} error={error} onStart={start} />;
  if (!activeItem) return <main className="exam-shell"><p className="exam-error"><FileWarning />This test version has no available questions. Please return to the dashboard.</p></main>;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const Icon = icons[currentSkill];
  return <main className="exam-shell">
    <header className="exam-topbar"><Link href="/dashboard"><ArrowLeft /> Exit to dashboard</Link><span><LockKeyhole /> Secure exam mode</span><div className={`exam-save-state ${saveState}`} >{saveState === "offline" ? <CloudOff /> : <Cloud />}<span><b>{saveState === "saving" ? "Saving…" : saveState === "offline" ? "Offline — recovery queued" : "All responses saved"}</b><small>{attempt.versionLabel}</small></span></div></header>
    <div className="exam-statusbar"><div>{MOCK_SKILLS.map((skill) => { const SkillIcon = icons[skill]; const skillItems = attempt.items.filter((item) => item.skill === skill); const completed = skillItems.filter(answered).length; return <span key={skill} className={skill === currentSkill ? "active" : completed === skillItems.length ? "done" : ""}><SkillIcon /><b>{skill}</b><small>{completed}/{skillItems.length}</small></span>; })}</div><strong className={remaining < 300 ? "urgent" : ""}><Clock3 /> {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</strong></div>
    <section className="exam-workspace">
      <aside className="exam-question-map"><header><Icon /><span><b>{currentSkill}</b><small>Question {sectionNumber} of {sectionTotal}</small></span></header><div>{attempt.items.map((item, index) => item.skill === currentSkill && <button key={item.key} className={index === currentIndex ? "active" : answered(item) ? "done" : ""} onClick={() => void goTo(index)}>{answered(item) ? <Check /> : index - sectionStart + 1}</button>)}</div><p><ShieldCheck /> Answers, transcripts, hints and pause controls stay hidden until submission.</p></aside>
      <article className="exam-question-card">
        <header><span>{currentSkill.toUpperCase()} · {activeItem.type.replaceAll("-", " ")}</span><h1>{activeItem.title}</h1><p>{activeItem.instruction}</p></header>
        {remaining === 0 ? <div className="exam-time-expired"><TimerReset /><h2>Time is up for {currentSkill}.</h2><p>Your saved answers are safe. Continue to the next section.</p><button onClick={() => void skipExpiredSection()}>Continue <ArrowRight /></button></div> : <>
          {currentSkill === "Reading" && activeItem.sourceText && <section className="exam-source"><small>READING PASSAGE</small>{activeItem.sourceText.split(/\n+/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>}
          {currentSkill === "Listening" && <section className="exam-listening"><div><Headphones /><span><b>Listening recording</b><small>{listeningPlayed[listeningKey] ? "Played once — replay disabled" : "One play only · no pause"}</small></span></div><button disabled={listeningPlayed[listeningKey]} onClick={playListening}><Play fill="currentColor" /> {listeningPlayed[listeningKey] ? "Played" : "Play once"}</button></section>}
          <section className="exam-prompt"><span>QUESTION {sectionNumber}</span><p>{activeItem.prompt}</p></section>
          <AnswerControl item={activeItem} value={answers[activeItem.key]} onChange={updateAnswer} />
          {currentSkill === "Writing" && <div className="exam-ai-action"><span><Sparkles /><b>{attempt.assessments[activeItem.key]?.complete ? "AI estimate securely captured" : "Submit this task for an AI band estimate"}</b><small>The estimate stays hidden during exam mode and goes to your teacher for moderation.</small></span><button disabled={assessingKey === activeItem.key || String(answers[activeItem.key] ?? "").trim().split(/\s+/).filter(Boolean).length < 40 || attempt.assessments[activeItem.key]?.complete} onClick={() => void assessWriting()}>{assessingKey === activeItem.key ? <LoaderCircle className="spin" /> : <Sparkles />} Assess task</button></div>}
          {currentSkill === "Speaking" && <div className={`exam-recorder ${recording ? "recording" : ""}`}><button disabled={Boolean(assessingKey) || attempt.assessments[activeItem.key]?.complete} onClick={recording ? stopRecording : () => void startRecording()}>{assessingKey === activeItem.key ? <LoaderCircle className="spin" /> : recording ? <Square fill="currentColor" /> : attempt.assessments[activeItem.key]?.complete ? <Check /> : <Mic2 />}</button><span><b>{assessingKey === activeItem.key ? "Transcribing and assessing…" : recording ? "Recording…" : attempt.assessments[activeItem.key]?.complete ? "Answer saved for teacher review" : "Record your complete answer"}</b><small>{String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")} / {Math.floor((activeItem.recordingSeconds ?? 120) / 60)}:{String((activeItem.recordingSeconds ?? 120) % 60).padStart(2, "0")}</small></span><ShieldCheck /></div>}
        </>}
        {error && <p className="exam-error"><FileWarning />{error}</p>}
        <footer><button disabled={currentIndex === 0} onClick={() => void goTo(currentIndex - 1)}><ChevronLeft /> Previous</button><span>Question {currentIndex + 1} of {attempt.items.length}</span><button className="primary" disabled={saving || Boolean(assessingKey) || recording} onClick={() => void next()}>{saving ? <LoaderCircle className="spin" /> : currentIndex === attempt.items.length - 1 ? <Trophy /> : null}{currentIndex === attempt.items.length - 1 ? "Submit full mock" : "Save & continue"}<ArrowRight /></button></footer>
      </article>
    </section>
  </main>;
}

function AnswerControl({ item, value, onChange }: { item: MockExamItem; value: unknown; onChange: (value: unknown) => void }) {
  if (item.type === "single-choice" || item.type === "true-false-not-given" || item.type === "yes-no-not-given") {
    const options = item.type === "true-false-not-given" ? ["True", "False", "Not Given"] : item.type === "yes-no-not-given" ? ["Yes", "No", "Not Given"] : item.options;
    return <div className="exam-choice-list">{options.map((option, index) => <button key={option} className={value === option ? "selected" : ""} onClick={() => onChange(option)}><i>{String.fromCharCode(65 + index)}</i><span>{option}</span>{value === option && <CheckCircle2 />}</button>)}</div>;
  }
  if (item.type === "multiple-choice") {
    const values = Array.isArray(value) ? value as string[] : [];
    return <div className="exam-choice-list multiple">{item.options.map((option, index) => <button key={option} className={values.includes(option) ? "selected" : ""} onClick={() => onChange(values.includes(option) ? values.filter((entry) => entry !== option) : [...values, option])}><i>{String.fromCharCode(65 + index)}</i><span>{option}</span>{values.includes(option) && <CheckCircle2 />}</button>)}</div>;
  }
  if (item.type === "matching") {
    const values = value && typeof value === "object" ? value as Record<string, string> : {};
    return <div className="exam-match-list">{item.pairs.map((pair) => <label key={pair.left}><span>{pair.left}</span><select value={values[pair.left] ?? ""} onChange={(event) => onChange({ ...values, [pair.left]: event.target.value })}><option value="">Choose a match</option>{item.options.map((option) => <option key={option}>{option}</option>)}</select></label>)}</div>;
  }
  if (item.type === "categorisation") {
    const values = value && typeof value === "object" ? value as Record<string, string> : {};
    return <div className="exam-match-list">{item.options.map((entry) => <label key={entry}><span>{entry}</span><select value={values[entry] ?? ""} onChange={(event) => onChange({ ...values, [entry]: event.target.value })}><option value="">Choose a category</option>{item.categories.map((category) => <option key={category.name}>{category.name}</option>)}</select></label>)}</div>;
  }
  if (item.type === "ordering") {
    const values = Array.isArray(value) ? value as string[] : item.options;
    return <div className="exam-order-list">{values.map((entry, index) => <div key={entry}><i>{index + 1}</i><span>{entry}</span><button disabled={index === 0} onClick={() => { const next = [...values]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }}>↑</button><button disabled={index === values.length - 1} onClick={() => { const next = [...values]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; onChange(next); }}>↓</button></div>)}</div>;
  }
  if (item.type === "essay-response" || item.type === "paragraph-response") {
    const words = String(value ?? "").trim().split(/\s+/).filter(Boolean).length;
    return <label className="exam-writing"><textarea rows={item.type === "essay-response" ? 18 : 10} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder="Write your response here. It saves automatically…" /><span>{words} words{item.maxWords ? ` · suggested maximum ${item.maxWords}` : ""}</span></label>;
  }
  if (item.type === "speaking-response") return null;
  return <label className="exam-short-answer"><span>Your answer</span><input value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} autoComplete="off" /></label>;
}

function MockLanding({ snapshot, userName, saving, error, onStart }: { snapshot: StudentMockSnapshot; userName: string; saving: boolean; error: string; onStart: () => void }) {
  const latest = snapshot.previousComparison?.current ?? null;
  return <main className="mock-engine-landing">
    <header><Link href="/dashboard"><ArrowLeft /> Dashboard</Link><span><Trophy /> Weekend Mock Challenge</span><span><ShieldCheck /> Secure assessment</span></header>
    <section className="mock-engine-hero"><div><span><Sparkles /> COMPLETE IELTS BENCHMARK</span><h1>Ready to measure your real progress, {userName.split(/[\s@]/)[0]}?</h1><p>A timed four-skill exam with automatic recovery, AI estimates, teacher moderation and a fresh version each week.</p><div>{MOCK_SKILLS.map((skill) => { const Icon = icons[skill]; const count = snapshot.available?.counts[skill] ?? 0; const minutes = snapshot.available ? snapshot.available[`${skill.toLowerCase()}Minutes` as "readingMinutes"] : 0; return <article key={skill}><Icon /><span><b>{skill}</b><small>{count} tasks · {minutes} min</small></span></article>; })}</div><button disabled={saving || snapshot.completedThisWeek || !snapshot.available} onClick={onStart}>{saving ? <LoaderCircle className="spin" /> : snapshot.completedThisWeek ? <Check /> : <Play fill="currentColor" />}{snapshot.completedThisWeek ? "This week’s mock is complete" : "Start secure mock"}</button>{error && <p className="exam-error"><FileWarning />{error}</p>}</div><aside><LockKeyhole /><h2>Exam mode protects the result</h2><ul><li><Check /> Timers continue during each section</li><li><Check /> Listening has no transcript or pause</li><li><Check /> Answers and AI bands stay hidden</li><li><Check /> Every response saves for recovery</li><li><Check /> Versions rotate every weekend</li></ul></aside></section>
    {latest && <MockReport snapshot={snapshot} latest={latest} />}
  </main>;
}

function readableAnswer(value: unknown) {
  if (value === null || value === undefined || value === "") return "No answer";
  if (Array.isArray(value)) return value.map((entry) => typeof entry === "object" ? JSON.stringify(entry) : String(entry)).join(" · ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, entry]) => `${key}: ${String(entry)}`).join(" · ");
  return String(value);
}

function MockReport({ snapshot, latest }: { snapshot: StudentMockSnapshot; latest: MockAttemptSummary }) {
  const comparison = snapshot.previousComparison;
  return <section className="mock-engine-report"><header><div><span><BarChart3 /> WEEKLY COMPARISON</span><h2>Your complete mock report</h2><p>{latest.testTitle} · {latest.versionLabel}</p></div><strong>{latest.overallBand?.toFixed(1) ?? "—"}<small>overall band</small>{comparison?.change !== null && comparison?.change !== undefined && <em className={comparison.change >= 0 ? "up" : "down"}>{comparison.change >= 0 ? "+" : ""}{comparison.change.toFixed(1)} vs previous</em>}</strong></header><div className="mock-band-grid">{MOCK_SKILLS.map((skill) => { const value = latest[`${skill.toLowerCase()}Band` as keyof MockAttemptSummary] as number | null; const previous = comparison?.previous?.[`${skill.toLowerCase()}Band` as keyof MockAttemptSummary] as number | null | undefined; return <article key={skill}><span>{skill}</span><b>{value?.toFixed(1) ?? "—"}</b><small>{previous ? `Previous ${previous.toFixed(1)}` : "First benchmark"}</small></article>; })}</div>{latest.teacherComment && <p className="mock-teacher-comment"><Sparkles /><span><b>Teacher comment</b>{latest.teacherComment}</span></p>}<div className="mock-mistakes"><header><span><FileWarning /> Detailed mistake review</span><small>Grouped by task type</small></header>{snapshot.mistakes.length ? snapshot.mistakes.map((mistake) => <article key={mistake.itemKey}><span className={mistake.correct === false ? "wrong" : "review"}>{mistake.correct === false ? "Incorrect" : "Review"}</span><div><b>{mistake.skill} · {mistake.questionType.replaceAll("-", " ")}</b><p>{mistake.title}</p>{mistake.correct === false && <dl><div><dt>Your answer</dt><dd>{readableAnswer(mistake.studentAnswer)}</dd></div><div><dt>Correct answer</dt><dd>{readableAnswer(mistake.correctAnswer)}</dd></div></dl>}<small>{mistake.feedback}</small></div></article>) : <p>No objective mistakes in your latest mock.</p>}</div><div className="mock-next-week"><Target /><span><b>Come back next weekend</b><p>A different version will unlock so your comparison reflects improvement, not memorisation.</p></span><Link href="/dashboard">Open study plan <ArrowRight /></Link></div></section>;
}
