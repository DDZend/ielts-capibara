import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { ListeningClient } from "./ListeningClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Listening course | IELTS Mastery",
  description: "Master the four IELTS Listening parts through twelve focused video lessons, guided audio practice and evidence-based review.",
};

export default async function ListeningPage() {
  const user = await requireChatGPTUser("/listening");
  return <ListeningClient userName={user.displayName} />;
}
