import type { Metadata } from "next";
import { getStudentClassSnapshot } from "../../db/classes";
import { requireChatGPTUser } from "../chatgpt-auth";
import { ClassesClient } from "./ClassesClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Classes & homework | IELTS Mastery",
  description: "Book teacher meetings, manage upcoming classes and complete assigned IELTS homework.",
};

export default async function ClassesPage() {
  const user = await requireChatGPTUser("/classes");
  return <ClassesClient userName={user.displayName} initialSnapshot={await getStudentClassSnapshot(user.email)} />;
}
