import type { Metadata } from "next";
import { requireCreatorUser } from "../../creator-auth";
import { ensureCreatorCatalog, getCreatorLessons } from "../../../db/creator";
import { ensureMockCatalog, getTeacherMockDashboard } from "../../../db/mock-engine";
import { MockTestStudioClient } from "./MockTestStudioClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mock-Test Studio | IELTS Mastery",
  description: "Build, publish and moderate full IELTS mock tests.",
};

export default async function MockTestStudioPage() {
  const user = await requireCreatorUser("/creator/mock-tests");
  await Promise.all([ensureCreatorCatalog(user.email), ensureMockCatalog(user.email)]);
  const lessons = await getCreatorLessons();
  const library = lessons.flatMap((lesson) => lesson.exercises.map((exercise) => ({
    ref: `${lesson.module}:${lesson.lessonId}:${exercise.id}`,
    module: lesson.module,
    lessonTitle: lesson.title,
    title: exercise.title,
    prompt: exercise.prompt,
    type: exercise.type,
    hasAudio: Boolean(lesson.audioMediaId),
    published: lesson.status === "published",
  })));
  return <MockTestStudioClient userName={user.displayName} initialDashboard={await getTeacherMockDashboard()} initialLibrary={library} />;
}
