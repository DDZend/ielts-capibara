"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronLeft, Clock3, Headphones, Mic2, Pause, PenLine, Play, ShieldCheck, Sparkles, Square, Target, TimerReset, Trophy, Volume2 } from "lucide-react";
import { calculateMock, type MockPayload, type SavedMock } from "../../lib/mock";
import { weekStart } from "../../lib/study-plan";

const readingQuestions = [
  { q: "Why did early public libraries often restrict borrowing?", options: ["Books were scarce and costly", "Readers preferred newspapers", "Buildings were too small"], answer: 0 },
  { q: "What changed during the nineteenth century?", options: ["Libraries became private clubs", "Public access expanded", "Printed books disappeared"], answer: 1 },
  { q: "What modern role is mentioned beyond lending books?", options: ["Selling technology", "Providing shared learning spaces", "Replacing schools"], answer: 1 },
  { q: "What challenge do libraries face today?", options: ["Balancing physical and digital services", "Finding any readers", "Publishing textbooks"], answer: 0 },
  { q: "What is the writer's main conclusion?", options: ["Libraries are becoming unnecessary", "Libraries adapt as community needs change", "Digital resources should be removed"], answer: 1 },
];

const listeningQuestions = [
  { q: "Where will the orientation begin?", options: ["The library entrance", "Room 204", "The student café"], answer: 0 },
  { q: "What time does it start?", options: ["9:15", "9:30", "10:00"], answer: 1 },
  { q: "Which room replaces Room 204?", options: ["Room 214", "Room 240", "Room 402"], answer: 0 },
  { q: "What must students bring?", options: ["A passport photo", "A student card", "A laptop"], answer: 1 },
  { q: "When should accessibility requests be made?", options: ["By Wednesday", "On Friday", "After the tour"], answer: 0 },
];

const announcement = "Welcome to the university library orientation. The tour begins at the main library entrance at nine thirty on Friday morning. After a short introduction, the research workshop will take place in room two fourteen, not room two oh four as shown in the original email. Please bring your student card to activate borrowing access. Students who need accessibility support should contact the library team by Wednesday afternoon.";
const stages = ["Briefing", "Reading", "Listening", "Writing", "Speaking", "Results"];

export function MockTestClient({ existingMocks, userName }: { existingMocks: SavedMock[]; userName: string }) {
  const currentWeek = weekStart();
  const completedThisWeek = existingMocks[0]?.weekStart === currentWeek;
  const [step, setStep] = useState(completedThisWeek ? 6 : 1);
  const [reading, setReading] = useState([-1, -1, -1, -1, -1]);
  const [listening, setListening] = useState([-1, -1, -1, -1, -1]);
  const [writing, setWriting] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [recordingCompleted, setRecordingCompleted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SavedMock | MockPayload | null>(completedThisWeek ? existingMocks[0] : null);
  const [previous, setPrevious] = useState<SavedMock | null>(completedThisWeek ? existingMocks[1] ?? null : existingMocks[0] ?? null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordCount = useMemo(() => writing.trim().split(/\s+/).filter(Boolean).length, [writing]);

  const stopRecording = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(false);
    setRecordingCompleted(true);
  }, []);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  const startRecording = async () => {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const nextRecorder = new MediaRecorder(stream);
      recorder.current = nextRecorder;
      nextRecorder.ondataavailable = () => undefined;
      nextRecorder.onstop = () => stream.getTracks().forEach((track) => track.stop());
      nextRecorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      timer.current = setInterval(() => setRecordingSeconds((seconds) => {
        if (seconds >= 59) { queueMicrotask(stopRecording); return 60; }
        return seconds + 1;
      }), 1000);
    } catch {
      setMicError("Microphone access is unavailable. You can still complete the mock with your confidence rating.");
    }
  };

  const playAnnouncement = () => {
    if (playing) { window.speechSynthesis.cancel(); setPlaying(false); return; }
    const speech = new SpeechSynthesisUtterance(announcement);
    speech.lang = "en-GB";
    speech.rate = .9;
    speech.onend = () => setPlaying(false);
    speech.onerror = () => setPlaying(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
    setPlaying(true);
  };

  const choose = (kind: "reading" | "listening", question: number, answer: number) => {
    const current = kind === "reading" ? reading : listening;
    const next = [...current];
    next[question] = answer;
    if (kind === "reading") setReading(next);
    else setListening(next);
  };

  const canContinue = step === 1 || (step === 2 && reading.every((answer) => answer >= 0)) || (step === 3 && listening.every((answer) => answer >= 0)) || (step === 4 && wordCount >= 80) || step === 5;

  const finish = async () => {
    if (recording) stopRecording();
    const calculated = calculateMock({
      readingCorrect: reading.filter((answer, index) => answer === readingQuestions[index].answer).length,
      listeningCorrect: listening.filter((answer, index) => answer === listeningQuestions[index].answer).length,
      writingText: writing,
      speakingConfidence: confidence,
      recordingCompleted,
    });
    setSaving(true);
    const response = await fetch("/api/mock-results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(calculated) }).catch(() => null);
    if (response?.ok) {
      const data = await response.json() as { current: SavedMock; previous: SavedMock | null };
      setResult(data.current);
      setPrevious(data.previous);
      setStep(6);
    }
    setSaving(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    if (step === 5) { void finish(); return; }
    setStep((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const difference = result && previous ? result.overallBand - previous.overallBand : null;
  return <main className="mock-shell">
    <header className="mock-header"><Link href="/dashboard"><ArrowLeft /> Dashboard</Link><span><Trophy /> Weekend Mock Challenge</span><span><Clock3 /> 20–25 minutes</span></header>
    <div className="mock-progress"><div>{stages.map((stage, index) => <span key={stage} className={step > index + 1 ? "done" : step === index + 1 ? "active" : ""}><i>{step > index + 1 ? <Check /> : index + 1}</i><small>{stage}</small></span>)}</div></div>
    <section className={`mock-card ${step === 6 ? "mock-results-card" : ""}`}>
      {step === 1 && <div className="mock-intro"><div><span className="eyebrow"><Sparkles /> Weekly progress check</span><h1>Challenge yourself across all four skills.</h1><p>Complete one focused mock each weekend, then compare your learning estimate with the previous week. This is practice—not an official IELTS test.</p><div className="mock-specs"><span><BookOpen /><b>Reading</b><small>Passage + 5 questions</small></span><span><Headphones /><b>Listening</b><small>Announcement + 5 questions</small></span><span><PenLine /><b>Writing</b><small>Minimum 80 words</small></span><span><Mic2 /><b>Speaking</b><small>One-minute response</small></span></div><div className="mock-privacy"><ShieldCheck /><span><b>Your private practice space</b><small>Writing and audio are never stored. Only your calculated bands are saved.</small></span></div></div><img src="/capi-challenge.png" alt="Capi Coach with a checklist and trophy" /></div>}
      {step === 2 && <><MockTitle icon={<BookOpen />} eyebrow="Reading · 8 minutes" title="Public libraries in a changing world" text="Read the passage and answer all five questions." /><article className="mock-passage"><p>Early public libraries were built around a simple problem: books were expensive and difficult for most people to obtain. Many institutions initially protected their collections by limiting borrowing, but during the nineteenth century a broader idea emerged—that access to knowledge could strengthen entire communities.</p><p>Modern libraries still lend books, yet their role has widened. They offer digital archives, quiet work areas, language courses and shared spaces where people can study together. For some visitors, free internet access and staff guidance are as important as the printed collection.</p><p>This expansion creates a difficult balance. Libraries must support new digital services without abandoning physical materials or the readers who depend on them. Their continued value may therefore lie not in one particular format, but in their ability to adapt as community needs change.</p></article><MockQuestions items={readingQuestions} answers={reading} name="reading" onChoose={(q, a) => choose("reading", q, a)} /></>}
      {step === 3 && <><MockTitle icon={<Headphones />} eyebrow="Listening · 6 minutes" title="University library orientation" text="Listen carefully for locations, times and corrected details." /><button className="mock-audio" onClick={playAnnouncement}><i>{playing ? <Pause /> : <Play fill="currentColor" />}</i><span><b>{playing ? "Pause announcement" : "Play announcement"}</b><small>English (UK) · replay allowed</small></span><Volume2 /></button><MockQuestions items={listeningQuestions} answers={listening} name="listening" onChoose={(q, a) => choose("listening", q, a)} /></>}
      {step === 4 && <><MockTitle icon={<PenLine />} eyebrow="Writing · 8 minutes" title="Technology and public spaces" text="Write a clear comparison with a supported opinion." /><article className="mock-prompt"><b>Some people believe public money should prioritise digital services, while others think traditional public spaces remain essential.</b><p>Discuss both views and give your own opinion.</p></article><label className="writing-area"><span className="sr-only">Mock writing response</span><textarea rows={13} value={writing} onChange={(event) => setWriting(event.target.value)} placeholder="Write at least 80 words…" /><span className={wordCount >= 80 ? "complete" : ""}>{wordCount}/80 words {wordCount >= 80 && <CheckCircle2 />}</span></label><p className="privacy-note"><ShieldCheck /> This response is scored locally and never saved.</p></>}
      {step === 5 && <><MockTitle icon={<Mic2 />} eyebrow="Speaking · up to 1 minute" title="Describe a useful public place" text="Explain where it is, what people do there, and why it matters." /><article className="mock-prompt"><b>You should speak for up to one minute.</b><p>Use a clear opening, two specific details and a short conclusion.</p></article><div className={`recorder ${recording ? "active" : ""}`}><button className="record-button" onClick={recording ? stopRecording : startRecording} aria-label={recording ? "Stop recording" : "Start recording"}>{recording ? <Square fill="currentColor" /> : <Mic2 />}</button><div><b>{recording ? "Recording…" : recordingCompleted ? "Recording complete" : "Ready when you are"}</b><span>00:{String(recordingSeconds).padStart(2, "0")} / 01:00</span></div><TimerReset /></div>{micError && <p className="form-error">{micError}</p>}<fieldset className="confidence-field"><legend>How confident did you feel?</legend><div>{[1,2,3,4,5].map((value) => <button key={value} type="button" className={confidence === value ? "selected" : ""} onClick={() => setConfidence(value)}><span>{value}</span><small>{value === 1 ? "Unsure" : value === 3 ? "Steady" : value === 5 ? "Confident" : ""}</small></button>)}</div></fieldset><p className="privacy-note"><ShieldCheck /> The recording remains on your device and is discarded.</p></>}
      {step === 6 && result && <MockResults result={result} previous={previous} difference={difference} userName={userName} />}
      {step < 6 && <div className="mock-actions"><button className="button ghost" disabled={step === 1} onClick={() => setStep((value) => Math.max(1, value - 1))}><ChevronLeft /> Back</button><span>{step === 1 ? "One saved attempt per week" : `Stage ${step} of 5`}</span><button className="button primary" disabled={!canContinue || saving} onClick={next}>{saving ? "Saving…" : step === 1 ? "Start the mock" : step === 5 ? "Finish and compare" : "Continue"}<ArrowRight /></button></div>}
    </section>
  </main>;
}

function MockTitle({ icon, eyebrow, title, text }: { icon: React.ReactNode; eyebrow: string; title: string; text: string }) {
  return <div className="mock-title"><span>{icon}</span><div><small>{eyebrow}</small><h1>{title}</h1><p>{text}</p></div></div>;
}

function MockQuestions({ items, answers, name, onChoose }: { items: typeof readingQuestions; answers: number[]; name: string; onChoose: (question: number, answer: number) => void }) {
  return <div className="mock-questions">{items.map((item, question) => <fieldset key={item.q}><legend><span>{question + 1}</span>{item.q}</legend>{item.options.map((option, answer) => <label key={option} className={answers[question] === answer ? "selected" : ""}><input type="radio" name={`${name}-${question}`} checked={answers[question] === answer} onChange={() => onChoose(question, answer)} /><i>{String.fromCharCode(65 + answer)}</i>{option}</label>)}</fieldset>)}</div>;
}

function MockResults({ result, previous, difference, userName }: { result: SavedMock | MockPayload; previous: SavedMock | null; difference: number | null; userName: string }) {
  const rows = [["Speaking", result.speakingBand], ["Writing", result.writingBand], ["Reading", result.readingBand], ["Listening", result.listeningBand]] as const;
  return <div className="mock-result"><div className="mock-result-hero"><div><span className="eyebrow light"><Trophy /> Weekend challenge complete</span><h1>Strong work, {userName.split(/[\s@]/)[0]}.</h1><p>{previous ? "Your new estimate is ready beside last week’s result." : "This is your first weekly benchmark. Return next weekend to compare."}</p></div><div><small>Overall estimate</small><strong>{result.overallBand.toFixed(1)}</strong>{difference !== null && <span className={difference >= 0 ? "up" : "down"}>{difference >= 0 ? "+" : ""}{difference.toFixed(1)} vs last week</span>}</div></div><div className="mock-comparison"><div className="comparison-head"><span>Skill</span><span>This week</span><span>Previous</span><span>Change</span></div>{rows.map(([skill, band]) => { const previousBand = previous ? previous[`${skill.toLowerCase()}Band` as keyof SavedMock] as number : null; const change = previousBand === null ? null : band - previousBand; return <div key={skill}><b>{skill}</b><strong>{band.toFixed(1)}</strong><span>{previousBand?.toFixed(1) ?? "—"}</span><i className={change !== null && change >= 0 ? "up" : ""}>{change === null ? "First result" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}`}</i></div>; })}</div><div className="mock-next"><Target /><div><b>Next week’s focus: {result.prioritySkill}</b><p>Use the daily plan to strengthen {result.prioritySkill.toLowerCase()}, then return next weekend for a fresh comparison.</p></div><Link className="button primary" href="/dashboard">Open my dashboard <ArrowRight /></Link></div><p className="mock-disclaimer">This is a preliminary learning estimate, not an official IELTS result.</p></div>;
}
