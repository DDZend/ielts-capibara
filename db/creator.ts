import { env } from "cloudflare:workers";
import { COURSE_CATALOG, type CourseModule } from "../lib/course-catalog";
import type { CreatorLessonContent, LessonStatus, StudentLessonContent } from "../lib/creator-content";
import { ensureAppSchema, getD1 } from "./index";

type CreatorLessonRow = {
  id: number;
  module: CourseModule;
  lesson_id: string;
  title: string;
  position: number;
  status: LessonStatus;
  video_media_id: number | null;
  video_file_name: string | null;
  audio_media_id: number | null;
  audio_file_name: string | null;
  vocabulary_json: string;
  exercises_json: string;
  transcript: string;
  answer_key_json: string;
  updated_at: string;
};

function parseStringList(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapLesson(row: CreatorLessonRow): CreatorLessonContent {
  return {
    id: row.id,
    module: row.module,
    lessonId: row.lesson_id,
    title: row.title,
    position: row.position,
    status: row.status,
    videoMediaId: row.video_media_id,
    videoFileName: row.video_file_name,
    videoUrl: row.video_media_id ? `/api/media/${row.video_media_id}` : null,
    audioMediaId: row.audio_media_id,
    audioFileName: row.audio_file_name,
    audioUrl: row.audio_media_id ? `/api/media/${row.audio_media_id}` : null,
    vocabulary: parseStringList(row.vocabulary_json),
    exercises: parseStringList(row.exercises_json),
    transcript: row.transcript,
    answerKey: parseStringList(row.answer_key_json),
    updatedAt: row.updated_at,
  };
}

export async function ensureCreatorCatalog(email: string) {
  await ensureAppSchema();
  const now = new Date().toISOString();
  await getD1().batch(COURSE_CATALOG.map((lesson, index) => {
    const position = COURSE_CATALOG.filter((candidate) => candidate.module === lesson.module).findIndex((candidate) => candidate.id === lesson.id);
    return getD1().prepare(`
      INSERT INTO creator_lessons (
        module, lesson_id, title, position, status, vocabulary_json, exercises_json,
        transcript, answer_key_json, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'published', '[]', '[]', '', '[]', ?, ?, ?)
      ON CONFLICT(module, lesson_id) DO NOTHING
    `).bind(lesson.module, lesson.id, lesson.title, position >= 0 ? position : index, email, now, now);
  }));
}

async function selectLessons(module?: CourseModule) {
  await ensureAppSchema();
  const where = module ? "WHERE l.module = ?" : "";
  const statement = getD1().prepare(`
    SELECT l.id, l.module, l.lesson_id, l.title, l.position, l.status,
      l.video_media_id, vm.file_name AS video_file_name,
      l.audio_media_id, am.file_name AS audio_file_name,
      l.vocabulary_json, l.exercises_json, l.transcript, l.answer_key_json, l.updated_at
    FROM creator_lessons l
    LEFT JOIN media_assets vm ON vm.id = l.video_media_id
    LEFT JOIN media_assets am ON am.id = l.audio_media_id
    ${where}
    ORDER BY CASE l.module WHEN 'Speaking' THEN 1 WHEN 'Writing' THEN 2 WHEN 'Reading' THEN 3 ELSE 4 END,
      l.position, l.id
  `);
  const result = module
    ? await statement.bind(module).all<CreatorLessonRow>()
    : await statement.all<CreatorLessonRow>();
  return (result.results ?? []).map(mapLesson);
}

export async function getCreatorLessons() {
  return selectLessons();
}

export async function getStudentCreatorLessons(module: CourseModule): Promise<StudentLessonContent[]> {
  return (await selectLessons(module)).map((lesson) => lesson.status === "published" ? {
    module: lesson.module,
    lessonId: lesson.lessonId,
    title: lesson.title,
    position: lesson.position,
    status: lesson.status,
    videoUrl: lesson.videoUrl,
    audioUrl: lesson.audioUrl,
    vocabulary: lesson.vocabulary,
    exercises: lesson.exercises,
    transcript: lesson.transcript,
    answerKey: lesson.answerKey,
  } : {
    module: lesson.module,
    lessonId: lesson.lessonId,
    title: "",
    position: lesson.position,
    status: lesson.status,
    videoUrl: null,
    audioUrl: null,
    vocabulary: [],
    exercises: [],
    transcript: "",
    answerKey: [],
  });
}

export async function updateCreatorLesson(input: {
  module: CourseModule;
  lessonId: string;
  title: string;
  status: LessonStatus;
  vocabulary: string[];
  exercises: string[];
  transcript: string;
  answerKey: string[];
  updatedBy: string;
}) {
  await ensureAppSchema();
  const updatedAt = new Date().toISOString();
  await getD1().prepare(`
    UPDATE creator_lessons SET title = ?, status = ?, vocabulary_json = ?, exercises_json = ?,
      transcript = ?, answer_key_json = ?, updated_by = ?, updated_at = ?
    WHERE module = ? AND lesson_id = ?
  `).bind(
    input.title,
    input.status,
    JSON.stringify(input.vocabulary),
    JSON.stringify(input.exercises),
    input.transcript,
    JSON.stringify(input.answerKey),
    input.updatedBy,
    updatedAt,
    input.module,
    input.lessonId,
  ).run();
  return (await selectLessons(input.module)).find((lesson) => lesson.lessonId === input.lessonId) ?? null;
}

export async function reorderCreatorLessons(module: CourseModule, lessonIds: string[], updatedBy: string) {
  await ensureAppSchema();
  const updatedAt = new Date().toISOString();
  await getD1().batch(lessonIds.map((lessonId, position) => getD1().prepare(`
    UPDATE creator_lessons SET position = ?, updated_by = ?, updated_at = ?
    WHERE module = ? AND lesson_id = ?
  `).bind(position, updatedBy, updatedAt, module, lessonId)));
  return selectLessons(module);
}

export function getMediaBucket() {
  if (!env.MEDIA) throw new Error("Cloudflare R2 binding `MEDIA` is unavailable.");
  return env.MEDIA;
}

export async function attachMedia(input: {
  module: CourseModule;
  lessonId: string;
  kind: "video" | "audio";
  fileName: string;
  contentType: string;
  sizeBytes: number;
  r2Key: string;
  ownerEmail: string;
}) {
  await ensureAppSchema();
  const createdAt = new Date().toISOString();
  const inserted = await getD1().prepare(`
    INSERT INTO media_assets (owner_email, r2_key, file_name, content_type, size_bytes, kind, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
  `).bind(input.ownerEmail, input.r2Key, input.fileName, input.contentType, input.sizeBytes, input.kind, createdAt)
    .first<{ id: number }>();
  if (!inserted) throw new Error("Could not save media metadata.");
  const mediaColumn = input.kind === "video" ? "video_media_id" : "audio_media_id";
  await getD1().prepare(`
    UPDATE creator_lessons SET ${mediaColumn} = ?, updated_by = ?, updated_at = ?
    WHERE module = ? AND lesson_id = ?
  `).bind(inserted.id, input.ownerEmail, createdAt, input.module, input.lessonId).run();
  return inserted.id;
}

export async function getMediaAssetForDelivery(id: number) {
  await ensureAppSchema();
  return getD1().prepare(`
    SELECT m.id, m.r2_key, m.file_name, m.content_type, m.size_bytes, m.kind,
      l.status AS lesson_status
    FROM media_assets m
    LEFT JOIN creator_lessons l ON l.video_media_id = m.id OR l.audio_media_id = m.id
    WHERE m.id = ? LIMIT 1
  `).bind(id).first<{
    id: number;
    r2_key: string;
    file_name: string;
    content_type: string;
    size_bytes: number;
    kind: string;
    lesson_status: LessonStatus | null;
  }>();
}
