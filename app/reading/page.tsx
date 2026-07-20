import type { Metadata } from "next";
import { requireLearningAccess } from "../learning-access";
import { ReadingClient } from "./ReadingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reading course | IELTS Mastery",
  description: "Master all 14 IELTS Academic Reading task types with practical strategies and source-linked practice texts.",
};

export default async function ReadingPage() {
  const user = await requireLearningAccess("/reading");
  return <ReadingClient userName={user.displayName} />;
}
