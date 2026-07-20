import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { getChatGPTUser, requireChatGPTUser } from "./chatgpt-auth";

function teacherEmails() {
  const values = env as unknown as Record<string, string | undefined>;
  return new Set(
    (values.TEACHER_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isCreatorEmail(email: string) {
  return teacherEmails().has(email.trim().toLowerCase());
}

export async function requireCreatorUser(returnTo = "/creator") {
  const user = await requireChatGPTUser(returnTo);
  if (isCreatorEmail(user.email)) return user;
  redirect("/dashboard?creator=restricted");
}

export async function getApiCreatorUser() {
  const user = await getChatGPTUser();
  if (!user) return { user: null, status: 401 as const };
  if (!isCreatorEmail(user.email)) return { user: null, status: 403 as const };
  return { user, status: 200 as const };
}
