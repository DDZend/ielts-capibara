import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getApiLearningUser } from "../../../learning-access";
import { getOwnedMockAttempt, saveMockAiAssessment, saveMockRecording } from "../../../../db/mock-engine";
import { parseMockItems } from "../../../../lib/mock-engine";

export const dynamic = "force-dynamic";
const MAX_AUDIO = 10 * 1024 * 1024;

const feedbackSchema = {
  type: "object", additionalProperties: false,
  properties: {
    overallBand: { type: "number", minimum: 1, maximum: 9 }, fluency: { type: "number", minimum: 1, maximum: 9 },
    lexicalResource: { type: "number", minimum: 1, maximum: 9 }, grammar: { type: "number", minimum: 1, maximum: 9 },
    pronunciation: { type: "number", minimum: 1, maximum: 9 }, summary: { type: "string", maxLength: 500 },
    strengths: { type: "array", items: { type: "string", maxLength: 180 }, minItems: 2, maxItems: 3 },
    priorities: { type: "array", items: { type: "string", maxLength: 180 }, minItems: 2, maxItems: 3 },
  }, required: ["overallBand", "fluency", "lexicalResource", "grammar", "pronunciation", "summary", "strengths", "priorities"],
} as const;

type OpenAIOutput = { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
const outputText = (payload: OpenAIOutput) => payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text ?? null;
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const access = await getApiLearningUser();
  if (!access.user) return json({ error: access.status === 401 ? "Authentication required" : "Active learning access required" }, access.status);
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const attemptId = Number(form?.get("attemptId"));
  const itemKey = form?.get("itemKey");
  if (!(audio instanceof File) || !audio.type.startsWith("audio/") || audio.size < 500 || audio.size > MAX_AUDIO || !Number.isInteger(attemptId) || typeof itemKey !== "string") {
    return json({ error: "Attach a valid Speaking recording under 10 MB." }, 400);
  }
  const attempt = await getOwnedMockAttempt(access.user.email, attemptId);
  const item = attempt ? parseMockItems(attempt.items_json).find((candidate) => candidate.key === itemKey && candidate.skill === "Speaking") : null;
  if (!attempt || attempt.status !== "in_progress" || !item) return json({ error: "Speaking task not found." }, 404);
  const apiKey = (env as unknown as { OPENAI_API_KEY?: string }).OPENAI_API_KEY;
  if (!apiKey) return json({ error: "AI feedback is not configured yet." }, 503);
  try {
    const transcriptionForm = new FormData();
    transcriptionForm.set("file", audio, audio.name || "mock-speaking.webm");
    transcriptionForm.set("model", "gpt-4o-transcribe");
    transcriptionForm.set("response_format", "json");
    transcriptionForm.set("prompt", "IELTS Academic Speaking exam response. Preserve natural wording and self-corrections.");
    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: transcriptionForm });
    if (!transcriptionResponse.ok) throw new Error(`Transcription failed with ${transcriptionResponse.status}`);
    const transcript = (await transcriptionResponse.json() as { text?: string }).text?.trim();
    if (!transcript) return json({ error: "The recording was not clear enough to assess." }, 422);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna", reasoning: { effort: "low" }, max_output_tokens: 1200,
        input: [
          { role: "developer", content: [{ type: "input_text", text: "Assess this IELTS Speaking response against fluency and coherence, lexical resource, grammatical range and accuracy, and pronunciation. The pronunciation score is a conservative intelligibility estimate from the transcript. Use half bands and never claim an official result." }] },
          { role: "user", content: [{ type: "input_text", text: `Speaking Part ${item.part ?? 1}\nQuestion: ${item.prompt}\nTranscript:\n${transcript.slice(0, 10000)}` }] },
        ], text: { format: { type: "json_schema", name: "mock_speaking_assessment", strict: true, schema: feedbackSchema } },
      }),
    });
    if (!response.ok) throw new Error(`Assessment failed with ${response.status}`);
    const output = outputText(await response.json() as OpenAIOutput);
    if (!output) throw new Error("No assessment returned");
    const feedback = JSON.parse(output) as { overallBand: number } & Record<string, unknown>;
    await saveMockAiAssessment({ email: access.user.email, attemptId, itemKey, aiBand: feedback.overallBand, feedback });
    await saveMockRecording({ email: access.user.email, attemptId, itemKey, fileName: audio.name || "mock-speaking.webm", contentType: audio.type, sizeBytes: audio.size, bytes: await audio.arrayBuffer(), transcript, feedback });
    return json({ complete: true, band: feedback.overallBand });
  } catch (error) {
    console.error("Mock Speaking assessment failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Capi could not assess this recording right now. Please record it again." }, 502);
  }
}
