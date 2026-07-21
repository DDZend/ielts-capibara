import type { Metadata } from "next";
import { requireLearningAccess } from "../learning-access";
import { WritingClient } from "./WritingClient";
import { getStudentCreatorLessons } from "../../db/creator";
import { CourseUnavailable } from "../CourseUnavailable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Writing course | IELTS Mastery",
  description: "Master the main IELTS Academic Writing Task 1 visuals and Task 2 essay types with guided practice and immediate AI feedback.",
};

export default async function WritingPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const { lesson } = await searchParams;
  const user = await requireLearningAccess("/writing");
  const creatorLessons = await getStudentCreatorLessons("Writing");
  if (creatorLessons.length && !creatorLessons.some((lesson) => lesson.status === "published")) return <CourseUnavailable module="Writing" />;
  return <WritingClient userName={user.displayName} creatorLessons={creatorLessons} initialLessonId={lesson} />;
}
