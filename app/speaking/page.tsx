import type { Metadata } from "next";
import { requireLearningAccess } from "../learning-access";
import { SpeakingClient } from "./SpeakingClient";
import { getStudentCreatorLessons } from "../../db/creator";
import { CourseUnavailable } from "../CourseUnavailable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Speaking practice | IELTS Mastery",
  description: "Learn the three IELTS Academic Speaking parts, practise useful language and get immediate AI feedback on a recorded answer.",
};

export default async function SpeakingPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const { lesson } = await searchParams;
  const user = await requireLearningAccess("/speaking");
  const creatorLessons = await getStudentCreatorLessons("Speaking");
  if (creatorLessons.length && !creatorLessons.some((lesson) => lesson.status === "published")) return <CourseUnavailable module="Speaking" />;
  return <SpeakingClient userName={user.displayName} creatorLessons={creatorLessons} initialLessonId={lesson} />;
}
