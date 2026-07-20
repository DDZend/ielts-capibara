import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getApiLearningUser } from "../../learning-access";
import { ensureAppSchema, getDashboardLearningData, getDb, getLatestAssessmentForEmail } from "../../../db";
import { studyTasks } from "../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getApiLearningUser();
  if (!access.user) return NextResponse.json({ error: access.status === 401 ? "Authentication required" : "Active learning access required" }, { status: access.status });
  const user = access.user;
  const assessment = await getLatestAssessmentForEmail(user.email);
  const data = await getDashboardLearningData(user.email, (assessment?.prioritySkill ?? "Reading") as "Speaking" | "Writing" | "Reading" | "Listening");
  return NextResponse.json({ tasks: data.tasks, recent: data.recent, stats: data.stats });
}

export async function PATCH(request: NextRequest) {
  const access = await getApiLearningUser();
  if (!access.user) return NextResponse.json({ error: access.status === 401 ? "Authentication required" : "Active learning access required" }, { status: access.status });
  const user = access.user;
  const body = await request.json().catch(() => null) as { id?: unknown; completed?: unknown } | null;
  if (!body || !Number.isInteger(body.id) || typeof body.completed !== "boolean") {
    return NextResponse.json({ error: "Invalid task update" }, { status: 400 });
  }
  await ensureAppSchema();
  const updated = await getDb().update(studyTasks)
    .set({ completedAt: body.completed ? new Date().toISOString() : null })
    .where(and(eq(studyTasks.id, Number(body.id)), eq(studyTasks.userEmail, user.email)))
    .returning();
  if (!updated.length) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task: updated[0] });
}
