"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CourseModule } from "../../lib/course-catalog";
import { COURSE_MODULES } from "../../lib/course-catalog";
import type { CreatorLessonContent, LessonStatus } from "../../lib/creator-content";
import type { CourseExercise } from "../../lib/exercise-types";
import { ExerciseBuilder } from "./ExerciseBuilder";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  CloudUpload,
  Eye,
  EyeOff,
  FileAudio,
  FileKey,
  FileText,
  Headphones,
  LoaderCircle,
  Mic2,
  PenLine,
  Save,
  Sparkles,
  Video,
} from "lucide-react";

type Editor = {
  title: string;
  status: LessonStatus;
  vocabularyText: string;
  exercises: CourseExercise[];
  transcript: string;
  answerKeyText: string;
};

const moduleIcons = { Speaking: Mic2, Writing: PenLine, Reading: BookOpen, Listening: Headphones };
const modulePaths = { Speaking: "/speaking", Writing: "/writing", Reading: "/reading", Listening: "/listening" };

function toEditor(lesson: CreatorLessonContent): Editor {
  return {
    title: lesson.title,
    status: lesson.status,
    vocabularyText: lesson.vocabulary.join("\n"),
    exercises: lesson.exercises,
    transcript: lesson.transcript,
    answerKeyText: lesson.answerKey.join("\n"),
  };
}

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

export function CreatorStudioClient({ userName, initialLessons }: { userName: string; initialLessons: CreatorLessonContent[] }) {
  const [lessons, setLessons] = useState(initialLessons);
  const [activeModule, setActiveModule] = useState<CourseModule>("Speaking");
  const [activeLessonId, setActiveLessonId] = useState(initialLessons[0]?.lessonId ?? "");
  const firstLesson = initialLessons[0];
  const [editor, setEditor] = useState<Editor>(firstLesson ? toEditor(firstLesson) : { title: "", status: "draft", vocabularyText: "", exercises: [], transcript: "", answerKeyText: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"video" | "audio" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const moduleLessons = useMemo(() => lessons.filter((lesson) => lesson.module === activeModule).sort((a, b) => a.position - b.position), [lessons, activeModule]);
  const activeLesson = moduleLessons.find((lesson) => lesson.lessonId === activeLessonId) ?? moduleLessons[0];
  const publishedCount = lessons.filter((lesson) => lesson.status === "published").length;

  const chooseModule = (module: CourseModule) => {
    const first = lessons.filter((lesson) => lesson.module === module).sort((a, b) => a.position - b.position)[0];
    setActiveModule(module);
    if (first) {
      setActiveLessonId(first.lessonId);
      setEditor(toEditor(first));
    }
    setMessage("");
    setError("");
  };

  const chooseLesson = (lesson: CreatorLessonContent) => {
    setActiveLessonId(lesson.lessonId);
    setEditor(toEditor(lesson));
    setMessage("");
    setError("");
  };

  const saveLesson = async (status: LessonStatus = editor.status) => {
    if (!activeLesson || saving) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/creator/lessons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: activeLesson.module,
          lessonId: activeLesson.lessonId,
          title: editor.title,
          status,
          vocabulary: lines(editor.vocabularyText),
          exercises: editor.exercises,
          transcript: editor.transcript,
          answerKey: lines(editor.answerKeyText),
        }),
      });
      const data = await response.json() as { lesson?: CreatorLessonContent; error?: string };
      if (!response.ok || !data.lesson) throw new Error(data.error ?? "Could not save this lesson.");
      setLessons((current) => current.map((lesson) => lesson.id === data.lesson?.id ? data.lesson : lesson));
      setEditor(toEditor(data.lesson));
      setMessage(status === "published" ? "Published to the student course." : status === "hidden" ? "Hidden from students." : "Draft saved privately.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this lesson.");
    } finally {
      setSaving(false);
    }
  };

  const moveLesson = async (direction: -1 | 1) => {
    if (!activeLesson || saving) return;
    const index = moduleLessons.findIndex((lesson) => lesson.id === activeLesson.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= moduleLessons.length) return;
    const reordered = [...moduleLessons];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/creator/lessons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: activeModule, lessonIds: reordered.map((lesson) => lesson.lessonId) }),
      });
      const data = await response.json() as { lessons?: CreatorLessonContent[]; error?: string };
      if (!response.ok || !data.lessons) throw new Error(data.error ?? "Could not reorder the lessons.");
      setLessons((current) => [...current.filter((lesson) => lesson.module !== activeModule), ...data.lessons!]);
      setMessage("Lesson order updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reorder the lessons.");
    } finally {
      setSaving(false);
    }
  };

  const uploadMedia = async (kind: "video" | "audio", file: File | undefined) => {
    if (!file || !activeLesson || uploading) return;
    setUploading(kind);
    setMessage("");
    setError("");
    const form = new FormData();
    form.set("module", activeLesson.module);
    form.set("lessonId", activeLesson.lessonId);
    form.set("kind", kind);
    form.set("file", file);
    try {
      const response = await fetch("/api/creator/media", { method: "POST", body: form });
      const data = await response.json() as { id?: number; url?: string; fileName?: string; error?: string };
      if (!response.ok || !data.id || !data.url) throw new Error(data.error ?? "Could not upload this file.");
      setLessons((current) => current.map((lesson) => lesson.id === activeLesson.id ? {
        ...lesson,
        ...(kind === "video"
          ? { videoMediaId: data.id!, videoUrl: data.url!, videoFileName: data.fileName ?? file.name }
          : { audioMediaId: data.id!, audioUrl: data.url!, audioFileName: data.fileName ?? file.name }),
      } : lesson));
      setMessage(`${kind === "video" ? "Video" : "Audio"} uploaded and attached. Publish the lesson when it is ready for students.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload this file.");
    } finally {
      setUploading(null);
    }
  };

  if (!activeLesson) return <main className="creator-shell"><p>No course lessons are available.</p></main>;
  const activeIndex = moduleLessons.findIndex((lesson) => lesson.id === activeLesson.id);
  const ActiveIcon = moduleIcons[activeModule];

  return (
    <main className="creator-shell">
      <header className="creator-topbar">
        <Link href="/dashboard"><ArrowLeft /> Student dashboard</Link>
        <span><Sparkles /> Private teacher workspace</span>
        <div><small>Signed in as</small><b>{userName}</b></div>
      </header>

      <section className="creator-hero">
        <div><span className="creator-kicker"><CloudUpload /> CREATOR STUDIO</span><h1>Publish the course without touching code.</h1><p>Upload your original media, add learning materials, control lesson order and decide exactly what students can see.</p></div>
        <aside><strong>{publishedCount}<small>published lessons</small></strong><strong>{lessons.length - publishedCount}<small>private or hidden</small></strong><Link href={modulePaths[activeModule]} target="_blank"><Eye /> Preview {activeModule}</Link></aside>
      </section>

      <section className="creator-workspace">
        <aside className="creator-library">
          <div className="creator-module-tabs">
            {COURSE_MODULES.map((module) => { const Icon = moduleIcons[module]; const count = lessons.filter((lesson) => lesson.module === module && lesson.status === "published").length; return <button key={module} className={activeModule === module ? "active" : ""} onClick={() => chooseModule(module)}><Icon /><span><b>{module}</b><small>{count} published</small></span></button>; })}
          </div>
          <div className="creator-lesson-list">
            <header><span><ActiveIcon /> {activeModule} lessons</span><small>Drag-free ordering</small></header>
            {moduleLessons.map((lesson, index) => <button key={lesson.id} className={lesson.id === activeLesson.id ? "active" : ""} onClick={() => chooseLesson(lesson)}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{lesson.title}</b><small className={lesson.status}>{lesson.status === "published" ? <Eye /> : <EyeOff />}{lesson.status}</small></span><ChevronRight /></button>)}
          </div>
        </aside>

        <form className="creator-editor" onSubmit={(event) => { event.preventDefault(); void saveLesson(); }}>
          <header className="creator-editor-heading">
            <div><span>{activeModule} · Lesson {String(activeIndex + 1).padStart(2, "0")}</span><h2>{activeLesson.title}</h2><p>Last changed {new Date(activeLesson.updatedAt).toLocaleString()}</p></div>
            <div className="creator-order-buttons"><button type="button" disabled={activeIndex === 0 || saving} onClick={() => void moveLesson(-1)} aria-label="Move lesson up"><ArrowUp /></button><button type="button" disabled={activeIndex === moduleLessons.length - 1 || saving} onClick={() => void moveLesson(1)} aria-label="Move lesson down"><ArrowDown /></button></div>
          </header>

          {(message || error) && <p className={`creator-message ${error ? "error" : "success"}`}>{error ? <CircleAlert /> : <Check />}{error || message}</p>}

          <section className="creator-panel creator-basics">
            <header><span>01</span><div><h3>Lesson details</h3><p>Name the lesson and control student visibility.</p></div></header>
            <label><span>Lesson title</span><input value={editor.title} maxLength={120} onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))} /></label>
            <div className="creator-status-options" role="radiogroup" aria-label="Lesson visibility">
              {(["published", "draft", "hidden"] as LessonStatus[]).map((status) => <button key={status} type="button" role="radio" aria-checked={editor.status === status} className={editor.status === status ? "active" : ""} onClick={() => setEditor((current) => ({ ...current, status }))}><span>{status === "published" ? <Eye /> : <EyeOff />}</span><b>{status}</b><small>{status === "published" ? "Visible to students" : status === "draft" ? "Teacher only" : "Removed from course"}</small></button>)}
            </div>
          </section>

          <section className="creator-panel">
            <header><span>02</span><div><h3>Video and listening audio</h3><p>New uploads replace the current student placeholder automatically.</p></div></header>
            <div className="creator-upload-grid">
              <label className={activeLesson.videoUrl ? "has-file" : ""}><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => void uploadMedia("video", event.target.files?.[0])} /><span>{uploading === "video" ? <LoaderCircle className="spin" /> : <Video />}</span><b>{uploading === "video" ? "Uploading video…" : activeLesson.videoFileName ?? "Upload lesson video"}</b><small>MP4, WebM or MOV · up to 100 MB</small>{activeLesson.videoUrl && <em><Check /> Ready</em>}</label>
              <label className={activeLesson.audioUrl ? "has-file" : ""}><input type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm" onChange={(event) => void uploadMedia("audio", event.target.files?.[0])} /><span>{uploading === "audio" ? <LoaderCircle className="spin" /> : <FileAudio />}</span><b>{uploading === "audio" ? "Uploading audio…" : activeLesson.audioFileName ?? "Upload practice audio"}</b><small>MP3, M4A, WAV, OGG or WebM · up to 25 MB</small>{activeLesson.audioUrl && <em><Check /> Ready</em>}</label>
            </div>
            {(activeLesson.videoUrl || activeLesson.audioUrl) && <div className="creator-media-preview">{activeLesson.videoUrl && <video controls preload="metadata" src={activeLesson.videoUrl} />}{activeLesson.audioUrl && <audio controls preload="metadata" src={activeLesson.audioUrl} />}</div>}
          </section>

          <section className="creator-panel creator-material-grid">
            <header><span>03</span><div><h3>Learning materials</h3><p>Add vocabulary, build interactive exercises, and provide transcripts or additional answer notes.</p></div></header>
            <label><span><BookOpen /> Vocabulary</span><textarea value={editor.vocabularyText} onChange={(event) => setEditor((current) => ({ ...current, vocabularyText: event.target.value }))} placeholder={'well-connected — easy to reach by transport\nOn balance — used to give a final judgement'} /></label>
            <div className="creator-exercise-builder wide"><span><FileText /> Interactive exercises</span><ExerciseBuilder exercises={editor.exercises} onChange={(exercises) => setEditor((current) => ({ ...current, exercises }))} /></div>
            <label className="wide"><span><FileAudio /> Transcript</span><textarea value={editor.transcript} onChange={(event) => setEditor((current) => ({ ...current, transcript: event.target.value }))} placeholder="Paste the complete video or listening transcript here…" /></label>
            <label className="wide"><span><FileKey /> Answer key</span><textarea value={editor.answerKeyText} onChange={(event) => setEditor((current) => ({ ...current, answerKeyText: event.target.value }))} placeholder={'1. well-connected\n2. Answers will vary; must include a reason and example.'} /></label>
          </section>

          <footer className="creator-actions">
            <span><Save /><small>Media uploads attach immediately. Text changes are saved when you use a button.</small></span>
            <div><button type="button" className="creator-hide" disabled={saving} onClick={() => void saveLesson("hidden")}><EyeOff /> Hide</button><button type="button" className="creator-draft" disabled={saving} onClick={() => void saveLesson("draft")}><Save /> Save draft</button><button type="button" className="creator-publish" disabled={saving} onClick={() => void saveLesson("published")}>{saving ? <LoaderCircle className="spin" /> : <CloudUpload />} Publish lesson</button></div>
          </footer>
        </form>
      </section>
    </main>
  );
}
