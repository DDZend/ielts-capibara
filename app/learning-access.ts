import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { hasLearningAccess } from "../db";
import { getChatGPTUser, requireChatGPTUser } from "./chatgpt-auth";

export function paywallEnabled() {
  const values = env as unknown as Record<string, string | undefined>;
  return values.PAYWALL_ENABLED?.trim().toLowerCase() === "true";
}

export async function learningAccessAllowed(email: string) {
  return !paywallEnabled() || hasLearningAccess(email);
}

export async function requireLearningAccess(returnTo: string) {
  const user = await requireChatGPTUser(returnTo);
  if (await learningAccessAllowed(user.email)) return user;
  redirect(`/billing?access=required&return_to=${encodeURIComponent(returnTo)}`);
}

export async function getApiLearningUser() {
  const user = await getChatGPTUser();
  if (!user) return { user: null, status: 401 as const };
  if (!await learningAccessAllowed(user.email)) return { user: null, status: 402 as const };
  return { user, status: 200 as const };
}
