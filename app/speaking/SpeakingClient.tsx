"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Headphones,
  Lightbulb,
  LockKeyhole,
  Mic2,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Target,
  Video,
  Volume2,
  WandSparkles,
} from "lucide-react";

type PartId = "part1" | "part2" | "part3";

type Lesson = {
  id: PartId;
  part: string;
  title: string;
  subtitle: string;
  timing: string;
  summary: string;
  videoTitle: string;
  videoUrl: string;
  videoFocus: string;
  prompt: string;
  promptNote: string;
  vocabulary: {
    word: string;
    question: string;
    options: string[];
    answer: string;
    explanation: string;
  };
  phrases: Array<{ phrase: string; use: string }>;
};

type Feedback = {
  overallBand: number;
  fluency: number;
  lexicalResource: number;
  grammar: number;
  pronunciation: number;
  summary: string;
  strengths: string[];
  priorities: string[];
  improvedAnswer: string;
  usefulPhrases: string[];
};

type SpeakingResponse = {
  transcript?: string;
  feedback?: Feedback;
  disclaimer?: string;
  error?: string;
};

const lessons: Lesson[] = [
  {
    id: "part1",
    part: "Part 1",
    title: "Warm, natural answers",
    subtitle: "Introduction and interview",
    timing: "4–5 min",
    summary: "Answer familiar questions directly, then add one reason or a specific detail. Aim for two or three natural sentences — not a memorised speech.",
    videoTitle: "Speaking: fluency and coherence",
    videoUrl: "https://takeielts.britishcouncil.org/teach-ielts/teaching-resources/videos/speaking-fluency-coherence",
    videoFocus: "Learn how clear sequencing, relevant detail and a steady pace help an answer feel easy to follow.",
    prompt: "Let’s talk about your hometown. What do you like most about the place where you live?",
    promptNote: "Speak for 30–45 seconds. Answer directly, explain why, then add one real example.",
    vocabulary: {
      word: "well-connected",
      question: "What does “well-connected” mean when describing a place?",
      options: ["It has convenient transport links", "Everyone knows each other", "It has modern internet only"],
      answer: "It has convenient transport links",
      explanation: "Use it for a neighbourhood or city that is easy to reach by bus, train or road.",
    },
    phrases: [
      { phrase: "What I like most is…", use: "give a direct answer" },
      { phrase: "The main reason is that…", use: "explain why" },
      { phrase: "For example,…", use: "add a specific detail" },
      { phrase: "Having said that,…", use: "add a balanced contrast" },
    ],
  },
  {
    id: "part2",
    part: "Part 2",
    title: "Build a confident long turn",
    subtitle: "Individual long turn",
    timing: "3–4 min",
    summary: "Use the one-minute preparation time to make a simple route: introduce the topic, cover the cue points, add a short story and finish with a reflection.",
    videoTitle: "Speaking: lexical resource",
    videoUrl: "https://takeielts.britishcouncil.org/teach-ielts/teaching-resources/videos/speaking-lexical-resource",
    videoFocus: "See how precise vocabulary, paraphrasing and natural collocations can strengthen a two-minute answer.",
    prompt: "Describe a skill you would like to learn. You should say what the skill is, how you would learn it, why it interests you, and explain how it could be useful.",
    promptNote: "Take up to 1 minute to prepare, then speak for 1–2 minutes without stopping.",
    vocabulary: {
      word: "a steep learning curve",
      question: "If a new skill has “a steep learning curve”, what does that suggest?",
      options: ["It is difficult at the beginning", "It is expensive to practise", "It becomes boring very quickly"],
      answer: "It is difficult at the beginning",
      explanation: "This phrase describes something that requires a lot of learning early on.",
    },
    phrases: [
      { phrase: "The skill I have in mind is…", use: "introduce the topic" },
      { phrase: "I first became interested in it when…", use: "begin a short story" },
      { phrase: "What appeals to me is…", use: "explain motivation" },
      { phrase: "In the long run,…", use: "finish with future value" },
    ],
  },
  {
    id: "part3",
    part: "Part 3",
    title: "Develop deeper ideas",
    subtitle: "Two-way discussion",
    timing: "4–5 min",
    summary: "Move from your opinion to a reason, an example and a consequence. Compare viewpoints and stay flexible when the examiner asks a follow-up question.",
    videoTitle: "Speaking: grammatical range and accuracy",
    videoUrl: "https://takeielts.britishcouncil.org/teach-ielts/teaching-resources/videos/speaking-grammar",
    videoFocus: "Review how a controlled mix of simple and complex sentences makes abstract ideas clearer.",
    prompt: "Why do some people prefer learning new skills online rather than learning them in person?",
    promptNote: "Speak for 45–75 seconds. Give a position, support it, and consider another side.",
    vocabulary: {
      word: "accessible",
      question: "In this discussion, what does “accessible” most nearly mean?",
      options: ["Easy for people to reach or use", "Academically advanced", "Popular with young people"],
      answer: "Easy for people to reach or use",
      explanation: "Online learning can be accessible because location, travel or fixed class times are less limiting.",
    },
    phrases: [
      { phrase: "From a broader perspective,…", use: "introduce a wider view" },
      { phrase: "This is largely because…", use: "give a strong reason" },
      { phrase: "A good example of this is…", use: "support the claim" },
      { phrase: "On the other hand,…", use: "compare another position" },
    ],
  },
];

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function SpeakingClient({ userName }: { userName: string }) {
  const [activeId, setActiveId] = useState<PartId>("part1");
  const [quizChoices, setQuizChoices] = useState<Partial<Record<PartId, string>>>({});
  const [checkedQuizzes, setCheckedQuizzes] = useState<Partial<Record<PartId, boolean>>>({});
  const [savedPhrases, setSavedPhrases] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [transcript, setTranscript] = useState("");
  const [feedbackState, setFeedbackState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const limitRef = useRef<number | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const lesson = lessons.find((item) => item.id === activeId) ?? lessons[0];
  const completedLessons = new Set<PartId>();
  for (const item of lessons) {
    if (checkedQuizzes[item.id] && quizChoices[item.id] === item.vocabulary.answer) completedLessons.add(item.id);
  }

  const clearTimers = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (limitRef.current !== null) window.clearTimeout(limitRef.current);
    timerRef.current = null;
    limitRef.current = null;
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearRecording = () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioUrl(null);
    setAudioBlob(null);
    setFeedback(null);
    setTranscript("");
    setFeedbackState("idle");
    setMessage("");
    setSeconds(0);
  };

  const stopRecording = () => {
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    stopStream();
    setIsRecording(false);
  };

  useEffect(() => () => {
    clearTimers();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopStream();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const chooseLesson = (id: PartId) => {
    if (id === activeId) return;
    stopRecording();
    clearRecording();
    setActiveId(id);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Audio recording is not supported in this browser. Try the latest Chrome, Edge or Safari.");
      setFeedbackState("error");
      return;
    }
    clearRecording();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || preferredType || "audio/webm" });
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          setAudioBlob(blob);
          setAudioUrl(url);
        }
        recorderRef.current = null;
      };
      recorder.start(750);
      setSeconds(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => setSeconds((current) => current + 1), 1000);
      limitRef.current = window.setTimeout(stopRecording, 120_000);
    } catch {
      stopStream();
      setMessage("Microphone access was blocked. Allow microphone permission and try again.");
      setFeedbackState("error");
    }
  };

  const submitRecording = async () => {
    if (!audioBlob) return;
    setFeedbackState("loading");
    setFeedback(null);
    setTranscript("");
    setMessage("");
    const extension = audioBlob.type.includes("mp4") ? "m4a" : "webm";
    const form = new FormData();
    form.set("audio", audioBlob, `speaking-${lesson.id}.${extension}`);
    form.set("part", lesson.id);
    form.set("prompt", lesson.prompt);
    const response = await fetch("/api/speaking-feedback", { method: "POST", body: form }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as SpeakingResponse : {};
    if (!response?.ok || !payload.feedback) {
      setFeedbackState("error");
      setMessage(payload.error ?? "Capi could not assess this recording. Please try again.");
      return;
    }
    setFeedback(payload.feedback);
    setTranscript(payload.transcript ?? "");
    setFeedbackState("idle");
  };

  const togglePhrase = (phrase: string) => {
    const key = `${lesson.id}:${phrase}`;
    setSavedPhrases((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  const criteria = feedback ? [
    { label: "Fluency & coherence", value: feedback.fluency },
    { label: "Lexical resource", value: feedback.lexicalResource },
    { label: "Grammar", value: feedback.grammar },
    { label: "Pronunciation clarity", value: feedback.pronunciation },
  ] : [];
  const firstName = userName.split(/[\s@]/)[0] || "Student";

  return (
    <main className="speaking-shell">
      <header className="speaking-header">
        <Link href="/dashboard"><ArrowLeft /> Dashboard</Link>
        <Link className="speaking-brand" href="/"><img src="/capi-profile.png" alt="" /><span><b>IELTS</b> Mastery</span></Link>
        <span><b>{completedLessons.size}</b> of 3 parts practised</span>
      </header>

      <section className="speaking-hero">
        <div className="speaking-hero-copy">
          <span className="speaking-kicker"><Mic2 /> Speaking course</span>
          <h1>Speak with a clear idea, <em>not a memorised script.</em></h1>
          <p>Learn each IELTS Academic Speaking part, practise the language immediately, then record a real answer for private AI feedback.</p>
          <div className="speaking-facts">
            <span><Clock3 /><b>11–14 min</b><small>complete test</small></span>
            <span><Video /><b>3 parts</b><small>guided lessons</small></span>
            <span><Target /><b>4 criteria</b><small>practice estimate</small></span>
          </div>
        </div>
        <div className="speaking-hero-art">
          <span className="sound-wave" aria-hidden="true">{[12,25,38,20,31,44,24,14,34,46,29,18].map((height, index) => <i key={index} style={{ height }} />)}</span>
          <img src="/capi-headset.png" alt="Capi Coach ready for a speaking lesson" />
          <span className="speaking-hero-note"><Sparkles /><b>Hi {firstName}!</b><small>Let’s make your next answer stronger.</small></span>
        </div>
      </section>

      <div className="speaking-layout">
        <aside className="speaking-course-nav">
          <span className="speaking-section-label">COURSE ROUTE</span>
          <h2>Master all three parts</h2>
          <nav aria-label="Speaking lessons">
            {lessons.map((item, index) => {
              const complete = completedLessons.has(item.id);
              return <button key={item.id} className={activeId === item.id ? "active" : ""} onClick={() => chooseLesson(item.id)} aria-current={activeId === item.id ? "step" : undefined}>
                <i>{complete ? <Check /> : index + 1}</i><span><small>{item.part} · {item.timing}</small><b>{item.title}</b></span><ChevronRight />
              </button>;
            })}
          </nav>
          <div className="speaking-criteria-note">
            <Target /><div><b>What Capi checks</b><p>Fluency, vocabulary, grammar and a limited pronunciation-clarity estimate.</p></div>
          </div>
          <a className="speaking-format-link" href="https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-speaking" target="_blank" rel="noreferrer">Official IELTS test format <ExternalLink /></a>
        </aside>

        <section className="speaking-lesson">
          <div className="speaking-lesson-heading">
            <span>{lesson.part} <i /> {lesson.timing}</span>
            <h2>{lesson.title}</h2>
            <p><b>{lesson.subtitle}.</b> {lesson.summary}</p>
          </div>

          <article className="speaking-video-card">
            <a className="speaking-video-poster" href={lesson.videoUrl} target="_blank" rel="noreferrer" aria-label={`Open official video: ${lesson.videoTitle}`}>
              <div><span><Video /> Official British Council lesson</span><h3>{lesson.videoTitle}</h3><p>{lesson.videoFocus}</p><b className="speaking-play"><Play fill="currentColor" /> Open video lesson</b></div>
              <img src="/capi-official.png" alt="Capi Coach presenting the official lesson resource" />
              <ExternalLink className="video-external" />
            </a>
            <footer><LockKeyhole /> The lesson opens on the official British Council website in a new tab.</footer>
          </article>

          <div className="speaking-after-video"><span>AFTER THE VIDEO</span><i /><small>Complete the three short tasks below</small></div>

          <article className="speaking-task-card vocabulary-task">
            <header><i>1</i><span><small>Vocabulary check</small><h3>{lesson.vocabulary.word}</h3></span><BookOpen /></header>
            <p>{lesson.vocabulary.question}</p>
            <div className="vocabulary-options">
              {lesson.vocabulary.options.map((option) => {
                const chosen = quizChoices[lesson.id] === option;
                const checked = checkedQuizzes[lesson.id];
                const correct = checked && option === lesson.vocabulary.answer;
                const wrong = checked && chosen && option !== lesson.vocabulary.answer;
                return <button key={option} className={`${chosen ? "chosen" : ""} ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}`} onClick={() => { setQuizChoices((current) => ({ ...current, [lesson.id]: option })); setCheckedQuizzes((current) => ({ ...current, [lesson.id]: false })); }}>
                  <i>{correct ? <Check /> : String.fromCharCode(65 + lesson.vocabulary.options.indexOf(option))}</i>{option}
                </button>;
              })}
            </div>
            <div className="vocabulary-check-row">
              <button className="button speaking-primary" disabled={!quizChoices[lesson.id]} onClick={() => setCheckedQuizzes((current) => ({ ...current, [lesson.id]: true }))}>Check answer</button>
              {checkedQuizzes[lesson.id] && <p className={quizChoices[lesson.id] === lesson.vocabulary.answer ? "success" : "retry"}>{quizChoices[lesson.id] === lesson.vocabulary.answer ? <Check /> : <RotateCcw />}{quizChoices[lesson.id] === lesson.vocabulary.answer ? lesson.vocabulary.explanation : "Not quite — try another meaning."}</p>}
            </div>
          </article>

          <article className="speaking-task-card phrase-task">
            <header><i>2</i><span><small>Phrase builder</small><h3>Save useful answer moves</h3></span><Lightbulb /></header>
            <p>Choose the phrases you want beside you while you practise. Use them as flexible building blocks, not a script.</p>
            <div className="phrase-grid">
              {lesson.phrases.map(({ phrase, use }) => {
                const selected = savedPhrases.includes(`${lesson.id}:${phrase}`);
                return <button key={phrase} className={selected ? "selected" : ""} onClick={() => togglePhrase(phrase)} aria-pressed={selected}><span><b>{phrase}</b><small>{use}</small></span><i>{selected ? <Check /> : "+"}</i></button>;
              })}
            </div>
          </article>

          <article className="speaking-task-card recording-task">
            <header><i>3</i><span><small>AI speaking practice</small><h3>Record your answer</h3></span><WandSparkles /></header>
            <div className="practice-prompt"><span><Mic2 /></span><div><small>{lesson.part} practice question</small><p>{lesson.prompt}</p><em>{lesson.promptNote}</em></div></div>

            <div className={`speaking-recorder ${isRecording ? "recording" : ""}`}>
              <button className="record-main" onClick={isRecording ? stopRecording : startRecording} aria-label={isRecording ? "Stop recording" : audioBlob ? "Record again" : "Start recording"}>
                {isRecording ? <Square fill="currentColor" /> : audioBlob ? <RotateCcw /> : <Mic2 />}
              </button>
              <div className="record-copy"><span><b>{isRecording ? "Recording your answer…" : audioBlob ? "Recording ready" : "Tap to start speaking"}</b><small>{isRecording ? "Stop when you have finished" : audioBlob ? "Listen before asking Capi to assess it" : "Your browser will ask for microphone permission"}</small></span><strong>{formatTime(seconds)}</strong></div>
              <div className="record-bars" aria-hidden="true">{[17,29,12,37,23,43,19,33,14,39,25,31,16,35,21,28].map((height, index) => <i key={index} style={{ height: isRecording ? height : 8 }} />)}</div>
            </div>

            {audioUrl && <div className="recording-review"><Volume2 /><audio controls src={audioUrl}>Your browser does not support audio playback.</audio><button onClick={() => { stopRecording(); clearRecording(); }}><RotateCcw /> Discard</button></div>}

            {feedbackState === "error" && message && <p className="speaking-error" role="alert"><CircleAlert />{message}</p>}

            <div className="feedback-submit-row">
              <span><LockKeyhole /><small><b>Private by design</b>Your recording is assessed for this response and is not saved to your profile.</small></span>
              <button className="button speaking-primary" disabled={!audioBlob || isRecording || feedbackState === "loading"} onClick={() => void submitRecording()}>{feedbackState === "loading" ? <><i className="speaking-spinner" /> Capi is assessing…</> : <>Get AI feedback <ArrowRight /></>}</button>
            </div>

            {feedback && <section className="speaking-feedback" aria-live="polite">
              <div className="feedback-hero">
                <span><Sparkles /> Capi&apos;s practice feedback</span><div><small>Estimated band</small><strong>{feedback.overallBand.toFixed(1)}</strong><em>Practice only</em></div><p>{feedback.summary}</p>
              </div>
              <div className="feedback-criteria">
                {criteria.map((criterion) => <div key={criterion.label}><span><b>{criterion.label}</b><strong>{criterion.value.toFixed(1)}</strong></span><i><em style={{ width: `${Math.max(8, criterion.value / 9 * 100)}%` }} /></i></div>)}
              </div>
              <div className="feedback-columns">
                <div className="strengths"><h4><Check /> What worked</h4>{feedback.strengths.map((item) => <p key={item}>{item}</p>)}</div>
                <div className="priorities"><h4><Target /> Work on next</h4>{feedback.priorities.map((item) => <p key={item}>{item}</p>)}</div>
              </div>
              <div className="feedback-improved"><span><WandSparkles /></span><div><small>A stronger version</small><p>{feedback.improvedAnswer}</p></div></div>
              <div className="feedback-phrases"><small>Useful phrases for another attempt</small>{feedback.usefulPhrases.map((phrase) => <span key={phrase}>{phrase}</span>)}</div>
              <details className="feedback-transcript"><summary><Headphones /> Read transcript</summary><p>{transcript}</p></details>
              <p className="feedback-disclaimer">Practice estimate only — not an official IELTS score. Pronunciation is a limited clarity estimate because the coach primarily evaluates the transcript.</p>
            </section>}
          </article>

          <div className="speaking-next">
            <span><b>{lesson.part} complete?</b><small>Move forward when you have checked the word and recorded at least one answer.</small></span>
            {lesson.id !== "part3" ? <button className="button speaking-soft" onClick={() => chooseLesson(lesson.id === "part1" ? "part2" : "part3")}>Next speaking part <ArrowRight /></button> : <Link className="button speaking-soft" href="/dashboard">Return to dashboard <ArrowRight /></Link>}
          </div>
        </section>
      </div>
    </main>
  );
}
