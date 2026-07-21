import type { Metadata } from "next";
import { requireLearningAccess } from "../learning-access";
import { ListeningClient } from "./ListeningClient";
import { getStudentCreatorLessons } from "../../db/creator";
import { CourseUnavailable } from "../CourseUnavailable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Listening course | IELTS Mastery",
  description: "Master the four IELTS Listening parts through twelve focused video lessons, guided audio practice and evidence-based review.",
};

export default async function ListeningPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const { lesson } = await searchParams;
  const user = await requireLearningAccess("/listening");
  const creatorLessons = await getStudentCreatorLessons("Listening");
  if (creatorLessons.length && !creatorLessons.some((lesson) => lesson.status === "published")) return <CourseUnavailable module="Listening" />;
  return <ListeningClient userName={user.displayName} creatorLessons={creatorLessons} initialLessonId={lesson} />;
}
