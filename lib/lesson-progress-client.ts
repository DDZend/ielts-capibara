export type SavedLessonProgress = {
  lessonId: string;
  module: "Speaking" | "Writing" | "Reading" | "Listening";
  score: number;
  correctCount: number;
  totalCount: number;
  status: string;
};

export async function loadLessonProgress(moduleName: SavedLessonProgress["module"]): Promise<SavedLessonProgress[]> {
  const response = await fetch(`/api/lesson-progress?module=${encodeURIComponent(moduleName)}`, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return [];
  const payload = await response.json().catch(() => null) as { progress?: SavedLessonProgress[] } | null;
  return payload?.progress ?? [];
}

export async function saveLessonProgress(input: {
  module: SavedLessonProgress["module"];
  lessonId: string;
  lessonTitle: string;
  score: number;
  correctCount: number;
  totalCount: number;
}) {
  return fetch("/api/lesson-progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => null);
}
