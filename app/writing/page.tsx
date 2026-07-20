import type { Metadata } from "next";
import { requireLearningAccess } from "../learning-access";
import { WritingClient } from "./WritingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Writing course | IELTS Mastery",
  description: "Master the main IELTS Academic Writing Task 1 visuals and Task 2 essay types with guided practice and immediate AI feedback.",
};

export default async function WritingPage() {
  const user = await requireLearningAccess("/writing");
  return <WritingClient userName={user.displayName} />;
}
