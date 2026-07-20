import type { CourseModule } from "./course-catalog";

export type LessonStatus = "published" | "draft" | "hidden";

export type CreatorLessonContent = {
  id: number;
  module: CourseModule;
  lessonId: string;
  title: string;
  position: number;
  status: LessonStatus;
  videoMediaId: number | null;
  videoFileName: string | null;
  videoUrl: string | null;
  audioMediaId: number | null;
  audioFileName: string | null;
  audioUrl: string | null;
  vocabulary: string[];
  exercises: string[];
  transcript: string;
  answerKey: string[];
  updatedAt: string;
};

export type StudentLessonContent = {
  module: CourseModule;
  lessonId: string;
  title: string;
  position: number;
  status: LessonStatus;
  videoUrl: string | null;
  audioUrl: string | null;
  vocabulary: string[];
  exercises: string[];
  transcript: string;
  answerKey: string[];
};

export function applyPublishedLessonOrder<T extends { id: string; title: string }>(baseLessons: T[], content: StudentLessonContent[]) {
  if (!content.length) return baseLessons;
  const configuration = new Map(content.map((lesson) => [lesson.lessonId, lesson]));
  return baseLessons
    .filter((lesson) => configuration.get(lesson.id)?.status === "published")
    .map((lesson) => ({ ...lesson, title: configuration.get(lesson.id)?.title || lesson.title }))
    .sort((a, b) => (configuration.get(a.id)?.position ?? 0) - (configuration.get(b.id)?.position ?? 0));
}
