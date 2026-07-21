import type { Metadata } from "next";
import { requireLearningAccess } from "../learning-access";
import { ReadingClient } from "./ReadingClient";
import { getStudentCreatorLessons } from "../../db/creator";
import { CourseUnavailable } from "../CourseUnavailable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reading course | IELTS Mastery",
  description: "Master all 14 IELTS Academic Reading task types with practical strategies and source-linked practice texts.",
};

export default async function ReadingPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const { lesson } = await searchParams;
  const user = await requireLearningAccess("/reading");
  const creatorLessons = await getStudentCreatorLessons("Reading");
  if (creatorLessons.length && !creatorLessons.some((lesson) => lesson.status === "published")) return <CourseUnavailable module="Reading" />;
  return <ReadingClient userName={user.displayName} creatorLessons={creatorLessons} initialLessonId={lesson} />;
}
