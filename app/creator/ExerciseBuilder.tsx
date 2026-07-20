"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  CircleDot,
  FilePenLine,
  GripVertical,
  Layers3,
  ListChecks,
  ListOrdered,
  Mic2,
  Plus,
  Rows3,
  TextCursorInput,
  Trash2,
  Workflow,
} from "lucide-react";
import type { CourseExercise, ExerciseCategory, ExercisePair, ExerciseType } from "../../lib/exercise-types";
import { createExercise, EXERCISE_TYPES } from "../../lib/exercise-types";

const typeIcons: Record<ExerciseType, typeof CircleDot> = {
  "single-choice": CircleDot,
  "multiple-choice": ListChecks,
  "true-false-not-given": Rows3,
  "yes-no-not-given": Rows3,
  matching: Workflow,
  categorisation: Layers3,
  ordering: ListOrdered,
  "fill-gap": TextCursorInput,
  "short-answer": FilePenLine,
  "paragraph-response": FilePenLine,
  "essay-response": FilePenLine,
  "speaking-response": Mic2,
};

function splitLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function pairsToText(pairs: ExercisePair[]) {
  return pairs.map((pair) => `${pair.left} => ${pair.right}`).join("\n");
}

function textToPairs(value: string): ExercisePair[] {
  return splitLines(value).flatMap((line) => {
    const [left, ...rightParts] = line.split("=>");
    const right = rightParts.join("=>").trim();
    return left?.trim() && right ? [{ left: left.trim(), right }] : [];
  });
}

function categoriesToText(categories: ExerciseCategory[]) {
  return categories.map((category) => `${category.name}: ${category.items.join(" | ")}`).join("\n");
}

function textToCategories(value: string): ExerciseCategory[] {
  return splitLines(value).flatMap((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) return [];
    const name = line.slice(0, separator).trim();
    const items = line.slice(separator + 1).split("|").map((item) => item.trim()).filter(Boolean);
    return name && items.length ? [{ name, items }] : [];
  });
}

export function ExerciseBuilder({ exercises, onChange }: { exercises: CourseExercise[]; onChange: (exercises: CourseExercise[]) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeId, setActiveId] = useState(exercises[0]?.id ?? "");
  const active = exercises.find((exercise) => exercise.id === activeId) ?? exercises[0];
  const groups = useMemo(() => [...new Set(EXERCISE_TYPES.map((type) => type.group))], []);

  const update = (patch: Partial<CourseExercise>) => {
    if (!active) return;
    onChange(exercises.map((exercise) => exercise.id === active.id ? { ...exercise, ...patch } : exercise));
  };

  const addExercise = (type: ExerciseType) => {
    const exercise = createExercise(type);
    onChange([...exercises, exercise]);
    setActiveId(exercise.id);
    setPickerOpen(false);
  };

  const removeExercise = () => {
    if (!active) return;
    const index = exercises.findIndex((exercise) => exercise.id === active.id);
    const next = exercises.filter((exercise) => exercise.id !== active.id);
    onChange(next);
    setActiveId(next[Math.min(index, next.length - 1)]?.id ?? "");
  };

  const moveExercise = (direction: -1 | 1) => {
    if (!active) return;
    const index = exercises.findIndex((exercise) => exercise.id === active.id);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= exercises.length) return;
    const next = [...exercises];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };

  return <div className="exercise-builder">
    <aside className="exercise-builder-list">
      <header><span><ListChecks /> Exercises</span><b>{exercises.length}</b></header>
      {exercises.map((exercise, index) => { const Icon = typeIcons[exercise.type]; return <button type="button" className={exercise.id === active?.id ? "active" : ""} key={exercise.id} onClick={() => setActiveId(exercise.id)}><i>{index + 1}</i><span><b>{exercise.title || "Untitled exercise"}</b><small><Icon />{EXERCISE_TYPES.find((type) => type.id === exercise.type)?.label}</small></span><ChevronRight /></button>; })}
      <button type="button" className="add-exercise" onClick={() => setPickerOpen((open) => !open)}><Plus /> Add exercise</button>
    </aside>

    <div className="exercise-builder-editor">
      {pickerOpen && <section className="exercise-type-picker">
        <header><div><small>EXERCISE LIBRARY</small><h4>Choose an interaction</h4></div><button type="button" onClick={() => setPickerOpen(false)}>Close</button></header>
        {groups.map((group) => <div key={group}><span>{group}</span><div>{EXERCISE_TYPES.filter((type) => type.group === group).map((type) => { const Icon = typeIcons[type.id]; return <button type="button" key={type.id} onClick={() => addExercise(type.id)}><Icon /><span><b>{type.label}</b><small>{type.description}</small></span></button>; })}</div></div>)}
      </section>}

      {!pickerOpen && !active && <section className="exercise-empty"><ListChecks /><h4>Build the first exercise</h4><p>Choose from twelve interactive exercise formats designed for IELTS lessons.</p><button type="button" onClick={() => setPickerOpen(true)}><Plus /> Choose a type</button></section>}

      {!pickerOpen && active && <section className="exercise-form">
        <header><span><GripVertical /><small>EXERCISE {exercises.findIndex((exercise) => exercise.id === active.id) + 1}</small><b>{EXERCISE_TYPES.find((type) => type.id === active.type)?.label}</b></span><div><button type="button" disabled={exercises[0]?.id === active.id} onClick={() => moveExercise(-1)} aria-label="Move exercise up"><ArrowUp /></button><button type="button" disabled={exercises.at(-1)?.id === active.id} onClick={() => moveExercise(1)} aria-label="Move exercise down"><ArrowDown /></button><button type="button" className="delete" onClick={removeExercise} aria-label="Delete exercise"><Trash2 /></button></div></header>
        <div className="exercise-common-fields">
          <label><span>Exercise title</span><input value={active.title} maxLength={120} onChange={(event) => update({ title: event.target.value })} /></label>
          <label><span>Student instruction <small>optional</small></span><input value={active.instruction} maxLength={1000} placeholder="Choose the best answer." onChange={(event) => update({ instruction: event.target.value })} /></label>
          <label className="wide"><span>Question or prompt</span><textarea value={active.prompt} maxLength={3000} placeholder="Write the complete question students will see…" onChange={(event) => update({ prompt: event.target.value })} /></label>
        </div>

        {(active.type === "single-choice" || active.type === "multiple-choice") && <div className="exercise-type-fields">
          <label><span>Answer options <small>one per line</small></span><textarea value={active.options.join("\n")} onChange={(event) => { const options = splitLines(event.target.value); update({ options, correctAnswers: active.correctAnswers.filter((answer) => options.includes(answer)) }); }} /></label>
          <fieldset><legend>{active.type === "single-choice" ? "Correct answer" : "Correct answers"}</legend>{active.options.map((option) => { const selected = active.correctAnswers.includes(option); return <button type="button" key={option} className={selected ? "selected" : ""} onClick={() => update({ correctAnswers: active.type === "single-choice" ? [option] : selected ? active.correctAnswers.filter((answer) => answer !== option) : [...active.correctAnswers, option] })}><i>{selected && <Check />}</i>{option}</button>; })}</fieldset>
        </div>}

        {(active.type === "true-false-not-given" || active.type === "yes-no-not-given") && <div className="exercise-three-way"><span>Correct answer</span><div>{(active.type === "true-false-not-given" ? ["True", "False", "Not Given"] : ["Yes", "No", "Not Given"]).map((answer) => <button type="button" key={answer} className={active.correctAnswers[0] === answer ? "selected" : ""} onClick={() => update({ correctAnswers: [answer] })}><i>{active.correctAnswers[0] === answer && <Check />}</i>{answer}</button>)}</div></div>}

        {active.type === "matching" && <label className="exercise-special-text"><span>Matching pairs <small>one pair per line: item =&gt; match</small></span><textarea value={pairsToText(active.pairs)} placeholder={'Heading A => Paragraph 3\nHeading B => Paragraph 1'} onChange={(event) => update({ pairs: textToPairs(event.target.value) })} /></label>}

        {active.type === "categorisation" && <label className="exercise-special-text"><span>Categories and items <small>Category: item | item</small></span><textarea value={categoriesToText(active.categories)} placeholder={'Renewable: wind | solar\nNon-renewable: coal | oil'} onChange={(event) => update({ categories: textToCategories(event.target.value) })} /></label>}

        {active.type === "ordering" && <label className="exercise-special-text"><span>Items in the correct order <small>one per line</small></span><textarea value={active.options.join("\n")} onChange={(event) => update({ options: splitLines(event.target.value) })} /></label>}

        {(active.type === "fill-gap" || active.type === "short-answer") && <div className="exercise-type-fields">
          <label><span>Accepted answers <small>include spelling alternatives</small></span><textarea value={active.correctAnswers.join("\n")} placeholder={'visitor centre\nvisitor center'} onChange={(event) => update({ correctAnswers: splitLines(event.target.value) })} /></label>
          <label className="compact-number"><span>Maximum words <small>optional</small></span><input type="number" min={1} max={20} value={active.maxWords ?? ""} onChange={(event) => update({ maxWords: event.target.value ? Number(event.target.value) : null })} /></label>
        </div>}

        {(active.type === "paragraph-response" || active.type === "essay-response") && <div className="exercise-type-fields extended">
          <label className="compact-number"><span>Suggested maximum words</span><input type="number" min={10} max={5000} value={active.maxWords ?? ""} onChange={(event) => update({ maxWords: event.target.value ? Number(event.target.value) : null })} /></label>
          <label><span>Model or sample answer <small>shown after submission</small></span><textarea value={active.sampleAnswer} maxLength={20000} onChange={(event) => update({ sampleAnswer: event.target.value })} /></label>
        </div>}

        {active.type === "speaking-response" && <div className="exercise-type-fields extended">
          <label className="compact-number"><span>Recording limit in seconds</span><input type="number" min={10} max={600} value={active.recordingSeconds ?? 120} onChange={(event) => update({ recordingSeconds: Number(event.target.value) || 120 })} /></label>
          <label><span>Model answer or teacher guidance <small>shown after recording</small></span><textarea value={active.sampleAnswer} maxLength={20000} onChange={(event) => update({ sampleAnswer: event.target.value })} /></label>
        </div>}
      </section>}
    </div>
  </div>;
}
