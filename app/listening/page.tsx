import type { Metadata } from "next";
import { requireLearningAccess } from "../learning-access";
import { ListeningClient } from "./ListeningClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Listening course | IELTS Mastery",
  description: "Master the four IELTS Listening parts through twelve focused video lessons, guided audio practice and evidence-based review.",
};

export default async function ListeningPage() {
  const user = await requireLearningAccess("/listening");
  return <ListeningClient userName={user.displayName} />;
}
