import type { Metadata } from "next";
import { getTeacherAccessRequest } from "../../db/staff";
import { requireChatGPTUser } from "../chatgpt-auth";
import { TeacherAccessClient } from "./TeacherAccessClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teacher access | IELTS Mastery",
  description: "Request or review access to the private IELTS Mastery teacher workspace.",
};

export default async function TeacherAccessPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const user = await requireChatGPTUser("/teacher-access");
  const { reason = "approval" } = await searchParams;
  return <TeacherAccessClient email={user.email} reason={reason} initialRequest={await getTeacherAccessRequest(user.email)} />;
}
