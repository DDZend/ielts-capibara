import type { ReactNode } from "react";
import { BookOpen, Check, FileKey, FileText, Headphones, ListChecks, Video } from "lucide-react";
import type { StudentLessonContent } from "../lib/creator-content";

export function PublishedLessonVideo({ content, fallback, className = "" }: { content?: StudentLessonContent; fallback: ReactNode; className?: string }) {
  if (!content?.videoUrl) return fallback;
  return <div className={`published-lesson-video ${className}`}><span><Video /> Teacher video · {content.title}</span><video controls preload="metadata" src={content.videoUrl}>Your browser does not support video playback.</video></div>;
}

export function PublishedLessonMaterials({ content }: { content?: StudentLessonContent }) {
  if (!content) return null;
  const hasMaterials = Boolean(content.audioUrl || content.vocabulary.length || content.exercises.length || content.transcript || content.answerKey.length);
  if (!hasMaterials) return null;
  return <section className="published-materials" aria-label="Teacher lesson materials">
    <header><span><BookOpen /></span><div><small>FROM YOUR TEACHER</small><h3>Lesson materials</h3><p>Use these resources after the video, then check your work.</p></div></header>
    {content.audioUrl && <div className="published-audio"><span><Headphones /><b>Listening practice</b></span><audio controls preload="metadata" src={content.audioUrl}>Your browser does not support audio playback.</audio></div>}
    {(content.vocabulary.length > 0 || content.exercises.length > 0) && <div className="published-material-grid">
      {content.vocabulary.length > 0 && <article><header><BookOpen /><b>Vocabulary</b></header><ul>{content.vocabulary.map((item, index) => <li key={`${item}-${index}`}><i>{index + 1}</i><span>{item}</span></li>)}</ul></article>}
      {content.exercises.length > 0 && <article><header><ListChecks /><b>Exercises</b></header><ol>{content.exercises.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol></article>}
    </div>}
    {content.transcript && <details className="published-disclosure"><summary><FileText /><span><b>Transcript</b><small>Open the complete lesson transcript</small></span></summary><div className="published-transcript">{content.transcript.split(/\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></details>}
    {content.answerKey.length > 0 && <details className="published-disclosure answer-key"><summary><FileKey /><span><b>Answer key</b><small>Open after completing the exercises</small></span></summary><ol>{content.answerKey.map((answer, index) => <li key={`${answer}-${index}`}><Check />{answer}</li>)}</ol></details>}
  </section>;
}
