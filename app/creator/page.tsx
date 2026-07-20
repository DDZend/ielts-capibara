import type { Metadata } from "next";
import { ensureCreatorCatalog, getCreatorLessons } from "../../db/creator";
import { requireCreatorUser } from "../creator-auth";
import { CreatorStudioClient } from "./CreatorStudioClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Creator Studio | IELTS Mastery",
  description: "Private lesson publishing studio for IELTS Mastery teachers.",
};

export default async function CreatorPage() {
  const user = await requireCreatorUser("/creator");
  await ensureCreatorCatalog(user.email);
  const lessons = await getCreatorLessons();
  return <CreatorStudioClient userName={user.displayName} initialLessons={lessons} />;
}
