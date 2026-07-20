import { NextResponse } from "next/server";
import { getApiLearningUser } from "../../learning-access";
import { autosaveMockAttempt, getStudentMockSnapshot, startMockAttempt, submitMockAttempt } from "../../../db/mock-engine";
import { MOCK_SKILLS, type MockSkill } from "../../../lib/mock-engine";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const access = await getApiLearningUser();
  if (!access.user) return json({ error: access.status === 401 ? "Authentication required" : "Active learning access required" }, access.status);
  return json(await getStudentMockSnapshot(access.user.email));
}

export async function POST(request: Request) {
  const access = await getApiLearningUser();
  if (!access.user) return json({ error: access.status === 401 ? "Authentication required" : "Active learning access required" }, access.status);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return json({ error: "Choose a valid exam action." }, 400);
  try {
    if (body.action === "start") {
      return json({ attempt: await startMockAttempt(access.user.email, access.user.displayName) }, 201);
    }
    if (body.action === "autosave") {
      if (!Number.isInteger(body.attemptId) || !body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)
        || !Number.isInteger(body.currentItemIndex) || !MOCK_SKILLS.includes(body.currentSection as MockSkill)) {
        return json({ error: "Invalid recovery data." }, 400);
      }
      return json(await autosaveMockAttempt({
        email: access.user.email,
        attemptId: Number(body.attemptId),
        answers: body.answers as Record<string, unknown>,
        currentItemIndex: Number(body.currentItemIndex),
        currentSection: body.currentSection as MockSkill,
      }));
    }
    if (body.action === "submit") {
      if (!Number.isInteger(body.attemptId)) return json({ error: "Invalid attempt." }, 400);
      return json(await submitMockAttempt(access.user.email, Number(body.attemptId)));
    }
    return json({ error: "Unsupported exam action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The exam could not be updated.";
    return json({ error: message }, message.includes("weekly") || message.includes("Complete") ? 409 : 400);
  }
}
