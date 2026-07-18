import type { Metadata } from "next";
import { getChatGPTUser } from "../chatgpt-auth";
import { AssessmentClient } from "./AssessmentClient";

export const metadata: Metadata = {
  title: "Free IELTS Assessment | IELTS Mastery",
  description: "A six-step IELTS diagnostic with a preliminary band estimate and personalised study plan.",
};

export default async function AssessmentPage() {
  const user = await getChatGPTUser();
  return <AssessmentClient initialSignedIn={Boolean(user)} />;
}
