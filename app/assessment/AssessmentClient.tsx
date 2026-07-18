"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Headphones,
  Languages,
  Mic2,
  Pause,
  PenLine,
  Play,
  Save,
  Sparkles,
  Square,
  Target,
  Volume2,
} from "lucide-react";
import { AssessmentPayload, calculateAssessment } from "../../lib/assessment";

type Answers = {
  targetBand: number;
  examTiming: string;
  currentLevel: string;
  weeklyHours: string;
  reading: number[];
  listening: number[];
  writingText: string;
  speakingConfidence: number;
  recordingCompleted: boolean;
};

const initialAnswers: Answers = {
  targetBand: 7,
  examTiming: "1–3 months",
  currentLevel: "B2",
  weeklyHours: "5–7 hours",
  reading: [-1, -1, -1],
  listening: [-1, -1, -1],
  writingText: "",
  speakingConfidence: 3,
  recordingCompleted: false,
};

const readingQuestions = [
  { question: "What is one advantage of handwriting mentioned in the passage?", options: ["It is always faster", "It can encourage deeper processing", "It automatically organises notes"], answer: 1 },
  { question: "Why can digital notes be useful after a lecture?", options: ["They are easier to search and reorganise", "They prevent distraction", "They improve handwriting"], answer: 0 },
  { question: "What does the writer recommend?", options: ["Only handwriting", "Only digital devices", "Choosing a method that matches the task"], answer: 2 },
];

const announcement = "Attention IELTS workshop participants. Saturday's listening workshop will begin at ten thirty in room fourteen, not room twelve. Please arrive fifteen minutes early and bring headphones. The session is free for registered students, but places must be confirmed by Thursday evening.";

const listeningQuestions = [
  { question: "When does the workshop begin?", options: ["10:15", "10:30", "12:00"], answer: 1 },
  { question: "What should students bring?", options: ["A laptop", "A dictionary", "Headphones"], answer: 2 },
  { question: "By when must places be confirmed?", options: ["Thursday evening", "Friday morning", "Saturday"], answer: 0 },
];

const labels = ["Your goal", "Reading", "Listening", "Writing", "Speaking", "Your plan"];
const pendingKey = "ielts-mastery-pending-result";

export function AssessmentClient({ initialSignedIn }: { initialSignedIn: boolean }) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [result, setResult] = useState<AssessmentPayload | null>(null);
  const [signedIn, setSignedIn] = useState(initialSignedIn);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [listeningPlaying, setListeningPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState("");
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const update = <K extends keyof Answers>(key: K, value: Answers[K]) => setAnswers((previous) => ({ ...previous, [key]: value }));
  const wordCount = useMemo(() => answers.writingText.trim().split(/\s+/).filter(Boolean).length, [answers.writingText]);

  const saveResult = useCallback(async (payload: AssessmentPayload) => {
    setSaveState("saving");
    const response = await fetch("/api/assessment-results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    if (response?.ok) {
      setSaveState("saved");
      sessionStorage.removeItem(pendingKey);
    } else {
      setSaveState(response?.status === 401 ? "idle" : "error");
    }
  }, []);

  useEffect(() => {
    const pending = sessionStorage.getItem(pendingKey);
    if (!pending) return;
    let parsed: AssessmentPayload;
    try { parsed = JSON.parse(pending) as AssessmentPayload; } catch { sessionStorage.removeItem(pendingKey); return; }
    fetch("/api/me").then((response) => {
      if (!response.ok) return;
      setSignedIn(true);
      setResult(parsed);
      setStep(6);
      void saveResult(parsed);
    }).catch(() => undefined);
  }, [saveResult]);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    if (timer.current) clearInterval(timer.current);
    mediaRecorder.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  const selectQuestion = (kind: "reading" | "listening", question: number, value: number) => {
    const next = [...answers[kind]];
    next[question] = value;
    update(kind, next);
  };

  const stopRecording = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
    setRecording(false);
    setAnswers((previous) => ({ ...previous, recordingCompleted: true }));
  }, []);

  const startRecording = async () => {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      recorder.ondataavailable = () => undefined;
      recorder.onstop = () => stream.getTracks().forEach((track) => track.stop());
      recorder.start();
      setRecordingSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => setRecordingSeconds((seconds) => {
        if (seconds >= 59) { queueMicrotask(stopRecording); return 60; }
        return seconds + 1;
      }), 1000);
    } catch {
      setMicError("Microphone access was not available. You can still rate your confidence and continue.");
    }
  };

  const playAnnouncement = () => {
    if (!("speechSynthesis" in window)) return;
    if (listeningPlaying) { window.speechSynthesis.cancel(); setListeningPlaying(false); return; }
    const utterance = new SpeechSynthesisUtterance(announcement);
    utterance.rate = 0.9;
    utterance.lang = "en-GB";
    utterance.onend = () => setListeningPlaying(false);
    utterance.onerror = () => setListeningPlaying(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setListeningPlaying(true);
  };

  const canContinue = step === 1 ||
    (step === 2 && answers.reading.every((value) => value >= 0)) ||
    (step === 3 && answers.listening.every((value) => value >= 0)) ||
    (step === 4 && wordCount >= 40) ||
    step === 5;

  const continueAssessment = () => {
    if (step < 5) { setStep((value) => value + 1); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (recording) stopRecording();
    const calculated = calculateAssessment({
      ...answers,
      readingCorrect: answers.reading.filter((value, index) => value === readingQuestions[index].answer).length,
      listeningCorrect: answers.listening.filter((value, index) => value === listeningQuestions[index].answer).length,
    });
    setResult(calculated);
    setStep(6);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (signedIn) void saveResult(calculated);
  };

  const signInToSave = () => {
    if (!result) return;
    sessionStorage.setItem(pendingKey, JSON.stringify(result));
    window.location.assign("/signin-with-chatgpt?return_to=%2Fassessment");
  };

  return (
    <main className="assessment-shell">
      <header className="assessment-header">
        <Link href="/" className="brand-mark" aria-label="IELTS Mastery home"><span className="brand-c">C</span><span><b>IELTS</b> Mastery</span></Link>
        <div className="assessment-meta"><span><Clock3 size={15} /> Free · about 12 minutes</span><label className="language-control compact"><Languages size={15} /><select aria-label="Language"><option>EN</option><option>RU</option><option>KZ</option></select></label>{!signedIn && <a href="/signin-with-chatgpt?return_to=%2Fassessment">Sign in</a>}</div>
      </header>

      <div className="assessment-progress" aria-label={`Step ${step} of 6`}><div className="progress-copy"><span>Step {step} of 6</span><b>{labels[step - 1]}</b><span>{Math.round(step / 6 * 100)}%</span></div><div className="progress-track"><span style={{ width: `${step / 6 * 100}%` }} /></div></div>

      <div className={`assessment-layout ${step === 6 ? "results-layout" : ""}`}>
        <section className="assessment-card">
          {step === 1 && <GoalStep answers={answers} update={update} />}
          {step === 2 && <QuestionStep title="Read for meaning, not every word" subtitle="Read the short passage, then answer three questions." icon={<BookOpen />} questions={readingQuestions} selected={answers.reading} onSelect={(q, value) => selectQuestion("reading", q, value)} passage />}
          {step === 3 && <QuestionStep title="Listen for practical details" subtitle="Play the announcement. You can listen twice if needed." icon={<Headphones />} questions={listeningQuestions} selected={answers.listening} onSelect={(q, value) => selectQuestion("listening", q, value)} audioControl={<button className="audio-player" onClick={playAnnouncement}><span>{listeningPlaying ? <Pause /> : <Play fill="currentColor" />}</span><span><b>{listeningPlaying ? "Pause announcement" : "Play workshop announcement"}</b><small>English (UK) · about 25 seconds</small></span><Volume2 size={20} /></button>} />}
          {step === 4 && <WritingStep text={answers.writingText} setText={(text) => update("writingText", text)} wordCount={wordCount} />}
          {step === 5 && <SpeakingStep recording={recording} seconds={recordingSeconds} completed={answers.recordingCompleted} confidence={answers.speakingConfidence} micError={micError} onRecord={recording ? stopRecording : startRecording} onConfidence={(value) => update("speakingConfidence", value)} />}
          {step === 6 && result && <ResultsStep result={result} saveState={saveState} signedIn={signedIn} onSave={signInToSave} />}

          {step < 6 && <div className="assessment-actions"><button className="button ghost" disabled={step === 1} onClick={() => setStep((value) => Math.max(1, value - 1))}><ChevronLeft size={18} /> Back</button><span>{step === 1 ? "Your answers are kept while this page is open." : step === 4 ? `${wordCount}/40 minimum words` : "Take your time—you can go back."}</span><button className="button primary" disabled={!canContinue} onClick={continueAssessment}>{step === 5 ? "See my results" : "Continue"}<ArrowRight size={18} /></button></div>}
        </section>
        {step < 6 && <aside className="assessment-capi"><img src="/capi-assessment.png" alt="Capi Coach with a clipboard and pencil" /><div><Sparkles size={16} /><b>Capi&apos;s note</b><p>{step === 1 ? "There are no wrong goals. We use this only to shape your starting plan." : step === 2 ? "Look for the writer’s main contrast before checking the details." : step === 3 ? "Dates, times and corrections are common IELTS listening clues." : step === 4 ? "A clear comparison matters more than complicated vocabulary." : "Speak naturally. This recording stays on your device and is discarded."}</p></div></aside>}
      </div>
    </main>
  );
}

function GoalStep({ answers, update }: { answers: Answers; update: <K extends keyof Answers>(key: K, value: Answers[K]) => void }) {
  const groups: { key: keyof Pick<Answers, "targetBand" | "examTiming" | "currentLevel" | "weeklyHours">; title: string; options: (string | number)[] }[] = [
    { key: "targetBand", title: "Target IELTS band", options: [6, 6.5, 7, 7.5] },
    { key: "examTiming", title: "When do you plan to take IELTS?", options: ["Within 1 month", "1–3 months", "3–6 months", "Not decided"] },
    { key: "currentLevel", title: "Your current English level", options: ["A2", "B1", "B2", "C1", "Not sure"] },
    { key: "weeklyHours", title: "Time available each week", options: ["Under 3 hours", "3–5 hours", "5–7 hours", "8+ hours"] },
  ];
  return <><div className="assessment-title"><span className="step-icon"><Target /></span><div><span className="eyebrow">Let&apos;s personalise your assessment</span><h1>What are you working towards?</h1><p>Your answers help us set the right difficulty and build a realistic study plan.</p></div></div><div className="goal-groups">{groups.map((group) => <fieldset key={group.key}><legend>{group.title}</legend><div className="choice-row">{group.options.map((option) => <button type="button" key={option} className={answers[group.key] === option ? "selected" : ""} onClick={() => update(group.key as never, option as never)}>{group.key === "targetBand" && "Band "}{option}{answers[group.key] === option && <Check size={15} />}</button>)}</div></fieldset>)}</div></>;
}

function QuestionStep({ title, subtitle, icon, questions, selected, onSelect, passage, audioControl }: { title: string; subtitle: string; icon: React.ReactNode; questions: typeof readingQuestions; selected: number[]; onSelect: (question: number, value: number) => void; passage?: boolean; audioControl?: React.ReactNode }) {
  return <><div className="assessment-title"><span className="step-icon">{icon}</span><div><h1>{title}</h1><p>{subtitle}</p></div></div>{passage && <article className="reading-passage"><span>Academic passage</span><h2>Taking notes: pen or keyboard?</h2><p>Students increasingly choose between handwritten and digital notes. Typing is often faster and makes information easy to search, copy and reorganise. This can be valuable when a course contains large amounts of factual material.</p><p>Handwriting, however, usually requires students to select and rephrase ideas because they cannot record every word. Researchers suggest that this extra mental processing may support understanding and long-term memory. Yet the benefit depends on how notes are used: handwritten pages that are never reviewed are unlikely to help.</p><p>Rather than declaring one method superior, educators increasingly recommend matching the tool to the task. Digital notes may suit fast lectures and collaborative projects, while handwritten summaries can help students review and connect important concepts.</p></article>}{audioControl}<div className="question-list">{questions.map((item, questionIndex) => <fieldset key={item.question}><legend><span>{questionIndex + 1}</span>{item.question}</legend>{item.options.map((option, optionIndex) => <label key={option} className={selected[questionIndex] === optionIndex ? "selected" : ""}><input type="radio" name={`question-${title}-${questionIndex}`} checked={selected[questionIndex] === optionIndex} onChange={() => onSelect(questionIndex, optionIndex)} /><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</label>)}</fieldset>)}</div></>;
}

function WritingStep({ text, setText, wordCount }: { text: string; setText: (value: string) => void; wordCount: number }) {
  return <><div className="assessment-title"><span className="step-icon writing"><PenLine /></span><div><h1>Show how you organise an idea</h1><p>Write a short response. We assess structure and language signals, not personal opinions.</p></div></div><article className="writing-prompt"><span>Writing prompt</span><h2>Compare classroom learning and online learning.</h2><p>What are the main advantages of each? Which is more effective for you, and why?</p></article><label className="writing-area"><span className="sr-only">Your writing response</span><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Write at least 40 words…" rows={12} /><span className={wordCount >= 40 ? "complete" : ""}>{wordCount} words {wordCount >= 40 && <CheckCircle2 size={15} />}</span></label><p className="privacy-note"><Check size={15} /> Your response is used only to calculate this estimate and is never saved.</p></>;
}

function SpeakingStep({ recording, seconds, completed, confidence, micError, onRecord, onConfidence }: { recording: boolean; seconds: number; completed: boolean; confidence: number; micError: string; onRecord: () => void; onConfidence: (value: number) => void }) {
  return <><div className="assessment-title"><span className="step-icon speaking"><Mic2 /></span><div><h1>Speak for up to one minute</h1><p>Your audio stays on this device and is discarded as soon as you leave this step.</p></div></div><article className="speaking-prompt"><span>Speaking Part 2</span><h2>Describe a skill you would like to learn.</h2><p>Say what the skill is, why you want to learn it, how you would learn it, and how it could help you.</p></article><div className={`recorder ${recording ? "active" : ""}`}><button onClick={onRecord} className="record-button" aria-label={recording ? "Stop recording" : "Start recording"}>{recording ? <Square fill="currentColor" /> : <Mic2 />}</button><div><b>{recording ? "Recording…" : completed ? "Practice recording complete" : "Ready when you are"}</b><span>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")} / 01:00</span></div><div className="record-bars" aria-hidden="true">{[12, 20, 28, 18, 34, 24, 16, 30, 22, 12].map((height, index) => <i key={index} style={{ height: recording ? height : 8 }} />)}</div></div>{micError && <p className="form-error">{micError}</p>}<fieldset className="confidence-field"><legend>How confident did you feel?</legend><div>{[1, 2, 3, 4, 5].map((value) => <button type="button" className={confidence === value ? "selected" : ""} key={value} onClick={() => onConfidence(value)}><span>{value}</span><small>{value === 1 ? "Very unsure" : value === 3 ? "Steady" : value === 5 ? "Very confident" : ""}</small></button>)}</div></fieldset><p className="privacy-note"><Check size={15} /> No audio is uploaded or permanently stored.</p></>;
}

function ResultsStep({ result, signedIn, saveState, onSave }: { result: AssessmentPayload; signedIn: boolean; saveState: string; onSave: () => void }) {
  const cards = [["Speaking", result.speakingBand], ["Writing", result.writingBand], ["Reading", result.readingBand], ["Listening", result.listeningBand]] as const;
  return <div className="results"><div className="results-hero"><div><span className="eyebrow"><Sparkles size={16} /> Your preliminary estimate</span><h1>You have a clear place to start.</h1><p>This is a learning estimate, not an official IELTS result. It helps us shape your first study plan.</p></div><div className="overall-score"><small>Estimated overall</small><strong>{result.overallBand.toFixed(1)}</strong><span>Target {result.targetBand.toFixed(1)}</span></div></div><div className="band-grid">{cards.map(([skill, band]) => <article className={skill.toLowerCase()} key={skill}><span>{skill === "Speaking" ? <Mic2 /> : skill === "Writing" ? <PenLine /> : skill === "Reading" ? <BookOpen /> : <Headphones />}</span><div><small>{skill}</small><b>{band.toFixed(1)}</b></div></article>)}</div><div className="plan-card"><div className="plan-copy"><span className="eyebrow">Your first four weeks</span><h2>Build from {result.strengthSkill.toLowerCase()}, focus on {result.prioritySkill.toLowerCase()}</h2><div className="plan-weeks"><span><b>Week 1</b>Learn the task patterns</span><span><b>Week 2</b>Build accuracy and control</span><span><b>Week 3</b>Practise at exam pace</span><span><b>Week 4</b>Review and reassess</span></div></div><img src="/capi-plan.png" alt="Capi Coach presenting a four-week study plan" /></div><div className={`save-panel ${saveState}`}><div>{saveState === "saved" ? <CheckCircle2 /> : <Save />}<span><b>{saveState === "saved" ? "Your result is saved" : signedIn ? saveState === "saving" ? "Saving your result…" : saveState === "error" ? "We couldn’t save just now" : "Ready to save" : "Keep your plan and track progress"}</b><small>{saveState === "saved" ? "Your dashboard is ready with this assessment." : signedIn ? "Your result is linked securely to your account." : "Sign in with ChatGPT to save this result securely."}</small></span></div>{saveState === "saved" ? <Link className="button primary" href="/dashboard">Go to my study plan <ArrowRight size={18} /></Link> : !signedIn ? <button className="button primary" onClick={onSave}>Sign in to save <ArrowRight size={18} /></button> : saveState === "error" ? <button className="button primary" onClick={() => window.location.reload()}>Try again</button> : null}</div><Link className="back-home" href="/"><ArrowLeft size={16} /> Return to IELTS Mastery</Link></div>;
}
