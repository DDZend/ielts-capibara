import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getApiLearningUser } from "../../../learning-access";
import { getOwnedMockAttempt, saveMockAiAssessment } from "../../../../db/mock-engine";
import { parseMockItems } from "../../../../lib/mock-engine";

export const dynamic = "force-dynamic";

const feedbackSchema = {
  type: "object", additionalProperties: false,
  properties: {
    overallBand: { type: "number", minimum: 1, maximum: 9 },
    taskAchievement: { type: "number", minimum: 1, maximum: 9 },
    coherence: { type: "number", minimum: 1, maximum: 9 },
    lexicalResource: { type: "number", minimum: 1, maximum: 9 },
    grammar: { type: "number", minimum: 1, maximum: 9 },
    summary: { type: "string", maxLength: 500 },
    strengths: { type: "array", items: { type: "string", maxLength: 180 }, minItems: 2, maxItems: 3 },
    priorities: { type: "array", items: { type: "string", maxLength: 180 }, minItems: 2, maxItems: 3 },
  },
  required: ["overallBand", "taskAchievement", "coherence", "lexicalResource", "grammar", "summary", "strengths", "priorities"],
} as const;

type OpenAIOutput = { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };

function outputText(payload: OpenAIOutput) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output ?? []) for (const content of item.content ?? []) if (content.type === "output_text") return content.text ?? null;
  return null;
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await getApiLearningUser();
  if (!access.user) return json({ error: access.status === 401 ? "Authentication required" : "Active learning access required" }, access.status);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !Number.isInteger(body.attemptId) || typeof body.itemKey !== "string" || typeof body.essay !== "string") return json({ error: "Invalid Writing response." }, 400);
  const essay = body.essay.trim();
  if (essay.length > 20_000) return json({ error: "Writing response is too long." }, 413);
  const words = essay.split(/\s+/).filter(Boolean).length;
  if (words < 40) return json({ error: "Write at least 40 words before requesting an estimate." }, 422);
  const attempt = await getOwnedMockAttempt(access.user.email, Number(body.attemptId));
  const item = attempt ? parseMockItems(attempt.items_json).find((candidate) => candidate.key === body.itemKey && candidate.skill === "Writing") : null;
  if (!attempt || attempt.status !== "in_progress" || !item) return json({ error: "Writing task not found." }, 404);
  const apiKey = (env as unknown as { OPENAI_API_KEY?: string }).OPENAI_API_KEY;
  if (!apiKey) return json({ error: "AI feedback is not configured yet." }, 503);
  const task = item.part === 1 ? 1 : 2;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna", reasoning: { effort: "low" }, max_output_tokens: 1300,
        input: [
          { role: "developer", content: [{ type: "input_text", text: `Assess this IELTS Academic Writing Task ${task} response against the four public criteria. Use half-band increments, be conservative when evidence is limited, and never claim this is an official score. Return concise teacher-ready feedback.` }] },
          { role: "user", content: [{ type: "input_text", text: `Task:\n${item.prompt}\n\nStudent response (${words} words):\n${essay}` }] },
        ],
        text: { format: { type: "json_schema", name: "mock_writing_assessment", strict: true, schema: feedbackSchema } },
      }),
    });
    if (!response.ok) throw new Error(`Assessment failed with ${response.status}`);
    const output = outputText(await response.json() as OpenAIOutput);
    if (!output) throw new Error("No assessment returned");
    const feedback = JSON.parse(output) as { overallBand: number } & Record<string, unknown>;
    await saveMockAiAssessment({ email: access.user.email, attemptId: attempt.id, itemKey: item.key, aiBand: feedback.overallBand, feedback });
    return json({ complete: true, band: feedback.overallBand, wordCount: words });
  } catch (error) {
    console.error("Mock Writing assessment failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Capi could not assess this response right now. Your writing is still saved." }, 502);
  }
}
