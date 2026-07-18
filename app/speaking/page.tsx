import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { SpeakingClient } from "./SpeakingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Speaking practice | IELTS Mastery",
  description: "Learn the three IELTS Academic Speaking parts, practise useful language and get immediate AI feedback on a recorded answer.",
};

export default async function SpeakingPage() {
  const user = await requireChatGPTUser("/speaking");
  return <SpeakingClient userName={user.displayName} />;
}
