import type { Metadata } from "next";
import { requireLearningAccess } from "../learning-access";
import { getStudentMockSnapshot } from "../../db/mock-engine";
import { MockTestClient } from "./MockTestClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Complete IELTS Mock Test | IELTS Mastery",
  description: "Take a secure four-skill IELTS mock with timers, AI estimates, teacher review and weekly comparison.",
};

export default async function MockTestPage() {
  const user = await requireLearningAccess("/mock-test");
  return <MockTestClient initialSnapshot={await getStudentMockSnapshot(user.email)} userName={user.displayName} />;
}
