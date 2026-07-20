"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  CircleAlert,
  ListChecks,
  Mic2,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import type { CourseExercise } from "../lib/exercise-types";
import { EXERCISE_TYPES } from "../lib/exercise-types";

function normalise(value: string) {
  return value.trim().toLowerCase().replace(/[.,!?;:]+$/g, "").replace(/\s+/g, " ");
}

function sameAnswers(first: string[], second: string[]) {
  const a = first.map(normalise).sort();
  const b = second.map(normalise).sort();
  return a.length === b.length && a.every((answer, index) => answer === b[index]);
}

export function PublishedExercises({ exercises }: { exercises: CourseExercise[] }) {
  if (!exercises.length) return null;
  return <section className="published-exercises"><header><ListChecks /><span><small>INTERACTIVE PRACTICE</small><h3>{exercises.length} {exercises.length === 1 ? "exercise" : "exercises"} from your teacher</h3></span></header>{exercises.map((exercise, index) => <ExerciseRunner key={exercise.id} exercise={exercise} number={index + 1} />)}</section>;
}

function ExerciseRunner({ exercise, number }: { exercise: CourseExercise; number: number }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState("");
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [order, setOrder] = useState(() => [...exercise.options].reverse());
  const [submitted, setSubmitted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordingUrlRef = useRef<string | null>(null);
  const typeLabel = EXERCISE_TYPES.find((type) => type.id === exercise.type)?.label ?? "Exercise";
  const matchingOptions = useMemo(() => [...exercise.pairs.map((pair) => pair.right)].reverse(), [exercise.pairs]);
  const categoryItems = useMemo(() => exercise.categories.flatMap((category) => category.items.map((item) => ({ item, answer: category.name }))), [exercise.categories]);
  const objective = !["paragraph-response", "essay-response", "speaking-response"].includes(exercise.type);

  const complete = exercise.type === "single-choice" || exercise.type === "true-false-not-given" || exercise.type === "yes-no-not-given"
    ? selected.length === 1
    : exercise.type === "multiple-choice"
      ? selected.length > 0
      : exercise.type === "matching"
        ? exercise.pairs.every((pair) => matches[pair.left])
        : exercise.type === "categorisation"
          ? categoryItems.every(({ item }) => categories[item])
          : exercise.type === "ordering"
            ? order.length === exercise.options.length
            : exercise.type === "fill-gap" || exercise.type === "short-answer"
              ? Boolean(textAnswer.trim())
              : exercise.type === "speaking-response"
                ? Boolean(recordingUrl)
                : Boolean(textAnswer.trim());

  const correct = exercise.type === "matching"
    ? exercise.pairs.every((pair) => normalise(matches[pair.left] ?? "") === normalise(pair.right))
    : exercise.type === "categorisation"
      ? categoryItems.every(({ item, answer }) => normalise(categories[item] ?? "") === normalise(answer))
      : exercise.type === "ordering"
        ? order.every((item, index) => item === exercise.options[index])
        : exercise.type === "fill-gap" || exercise.type === "short-answer"
          ? exercise.correctAnswers.some((answer) => normalise(answer) === normalise(textAnswer))
          : sameAnswers(selected, exercise.correctAnswers);

  const clearRecorder = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => () => {
    clearRecorder();
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
  }, []);

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    clearRecorder();
    setRecording(false);
  };

  const startRecording = async () => {
    setRecordingError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("Recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
        const url = URL.createObjectURL(blob);
        recordingUrlRef.current = url;
        setRecordingUrl(url);
      };
      setRecordingSeconds(0);
      setSubmitted(false);
      setRecording(true);
      recorder.start(500);
      timerRef.current = window.setInterval(() => setRecordingSeconds((seconds) => {
        const next = seconds + 1;
        if (next >= (exercise.recordingSeconds ?? 120)) window.setTimeout(stopRecording, 0);
        return next;
      }), 1000);
    } catch {
      clearRecorder();
      setRecordingError("Microphone access was blocked. Allow it and try again.");
    }
  };

  const reset = () => {
    setSelected([]);
    setTextAnswer("");
    setMatches({});
    setCategories({});
    setOrder([...exercise.options].reverse());
    setSubmitted(false);
  };

  return <article className={`published-exercise ${submitted ? objective ? correct ? "correct" : "incorrect" : "review" : ""}`}>
    <header><i>{number}</i><span><small>{typeLabel}</small><h4>{exercise.title}</h4></span></header>
    {exercise.instruction && <p className="exercise-instruction">{exercise.instruction}</p>}
    <p className="exercise-prompt">{exercise.prompt}</p>

    {(exercise.type === "single-choice" || exercise.type === "multiple-choice" || exercise.type === "true-false-not-given" || exercise.type === "yes-no-not-given") && <div className="student-choice-options">{(exercise.type === "true-false-not-given" ? ["True", "False", "Not Given"] : exercise.type === "yes-no-not-given" ? ["Yes", "No", "Not Given"] : exercise.options).map((option) => { const checked = selected.includes(option); return <button type="button" disabled={submitted} className={checked ? "selected" : ""} key={option} onClick={() => setSelected(exercise.type === "multiple-choice" ? checked ? selected.filter((answer) => answer !== option) : [...selected, option] : [option])}><i>{checked && <Check />}</i>{option}</button>; })}</div>}

    {exercise.type === "matching" && <div className="student-matching">{exercise.pairs.map((pair) => <label key={pair.left}><span>{pair.left}</span><select disabled={submitted} value={matches[pair.left] ?? ""} onChange={(event) => setMatches((current) => ({ ...current, [pair.left]: event.target.value }))}><option value="">Choose a match</option>{matchingOptions.map((option) => <option key={option}>{option}</option>)}</select></label>)}</div>}

    {exercise.type === "categorisation" && <div className="student-matching">{categoryItems.map(({ item }) => <label key={item}><span>{item}</span><select disabled={submitted} value={categories[item] ?? ""} onChange={(event) => setCategories((current) => ({ ...current, [item]: event.target.value }))}><option value="">Choose a category</option>{exercise.categories.map((category) => <option key={category.name}>{category.name}</option>)}</select></label>)}</div>}

    {exercise.type === "ordering" && <div className="student-ordering">{order.map((item, index) => <div key={`${item}-${index}`}><i>{index + 1}</i><span>{item}</span><button type="button" disabled={submitted || index === 0} onClick={() => setOrder((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}><ArrowUp /></button><button type="button" disabled={submitted || index === order.length - 1} onClick={() => setOrder((current) => { const next = [...current]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}><ArrowDown /></button></div>)}</div>}

    {(exercise.type === "fill-gap" || exercise.type === "short-answer") && <div className="student-short-answer"><input disabled={submitted} value={textAnswer} onChange={(event) => setTextAnswer(event.target.value)} placeholder="Type your answer" />{exercise.maxWords && <small>Maximum {exercise.maxWords} words</small>}</div>}

    {(exercise.type === "paragraph-response" || exercise.type === "essay-response") && <div className="student-long-answer"><textarea disabled={submitted} value={textAnswer} onChange={(event) => setTextAnswer(event.target.value)} placeholder="Write your response here…" /><span><b>{textAnswer.trim() ? textAnswer.trim().split(/\s+/).length : 0}</b>{exercise.maxWords ? ` / ${exercise.maxWords} words` : " words"}</span></div>}

    {exercise.type === "speaking-response" && <div className="student-speaking-answer"><div><button type="button" className={recording ? "recording" : ""} onClick={recording ? stopRecording : () => void startRecording()}>{recording ? <Square /> : <Mic2 />}{recording ? "Stop recording" : recordingUrl ? "Record again" : "Start recording"}</button><span><b>{recordingSeconds}s</b> / {exercise.recordingSeconds ?? 120}s</span></div>{recordingUrl && <audio controls src={recordingUrl} />}{recordingError && <p><CircleAlert />{recordingError}</p>}</div>}

    {!submitted ? <footer><button type="button" disabled={!complete} onClick={() => setSubmitted(true)}>{objective ? "Check answer" : exercise.type === "speaking-response" ? "Finish and view guidance" : "Compare response"}<ChevronRight /></button></footer> : <footer className="exercise-result"><p>{objective ? correct ? <><Check /><span><b>Correct.</b> Well done.</span></> : <><CircleAlert /><span><b>Try this one again.</b>{exercise.type === "fill-gap" || exercise.type === "short-answer" ? ` Accepted answer: ${exercise.correctAnswers[0]}.` : " Review the options and evidence."}</span></> : <><Play /><span><b>Your response is ready to review.</b>Compare it with the teacher guidance below.</span></>}</p><button type="button" onClick={reset}><RotateCcw /> Try again</button></footer>}
    {submitted && !objective && exercise.sampleAnswer && <div className="exercise-sample"><small>TEACHER GUIDANCE / MODEL</small><p>{exercise.sampleAnswer}</p></div>}
  </article>;
}
