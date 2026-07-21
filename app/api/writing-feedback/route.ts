import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { getApiLearningUser } from "../../learning-access";
import { saveAiPracticeAssessment } from "../../../db";

export const dynamic = "force-dynamic";

const MAX_ESSAY_CHARACTERS = 20_000;
const VALID_LESSONS = new Set([
  "line-graph", "bar-chart", "pie-chart", "table", "process", "maps-plans", "mixed-visuals",
  "opinion", "discussion", "advantages", "problem-solution", "two-part",
]);

const feedbackSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overallBand: { type: "number", minimum: 1, maximum: 9 },
    taskAchievement: { type: "number", minimum: 1, maximum: 9 },
    coherence: { type: "number", minimum: 1, maximum: 9 },
    lexicalResource: { type: "number", minimum: 1, maximum: 9 },
    grammar: { type: "number", minimum: 1, maximum: 9 },
    summary: { type: "string", maxLength: 480 },
    strengths: { type: "array", items: { type: "string", maxLength: 190 }, minItems: 2, maxItems: 3 },
    priorities: { type: "array", items: { type: "string", maxLength: 190 }, minItems: 2, maxItems: 3 },
    improvedPlan: { type: "array", items: { type: "string", maxLength: 190 }, minItems: 3, maxItems: 5 },
    correctedExcerpt: { type: "string", maxLength: 1200 },
    usefulPhrases: { type: "array", items: { type: "string", maxLength: 120 }, minItems: 3, maxItems: 5 },
  },
  required: ["overallBand", "taskAchievement", "coherence", "lexicalResource", "grammar", "summary", "strengths", "priorities", "improvedPlan", "correctedExcerpt", "usefulPhrases"],
} as const;

type OpenAIOutput = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

type WritingFeedback = {
  overallBand: number;
  taskAchievement: number;
  coherence: number;
  lexicalResource: number;
  grammar: number;
  summary: string;
  strengths: string[];
  priorities: string[];
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function outputText(payload: OpenAIOutput): string | null {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

type WritingPayload = { lessonId: string; task: 1 | 2; prompt: string; essay: string };

function isWritingPayload(value: unknown): value is WritingPayload {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<WritingPayload>;
  return typeof body.lessonId === "string" && VALID_LESSONS.has(body.lessonId)
    && (body.task === 1 || body.task === 2)
    && typeof body.prompt === "string" && body.prompt.length >= 20 && body.prompt.length <= 2_500
    && typeof body.essay === "string" && body.essay.length <= MAX_ESSAY_CHARACTERS;
}

export async function POST(request: NextRequest) {
  const access = await getApiLearningUser();
  if (!access.user) return json({ error: access.status === 401 ? "Authentication required" : "Active learning access required" }, access.status);
  const user = access.user;

  const body: unknown = await request.json().catch(() => null);
  if (!isWritingPayload(body)) return json({ error: "Invalid writing submission." }, 400);
  const essay = body.essay.trim();
  const wordCount = essay.split(/\s+/).filter(Boolean).length;
  if (wordCount < 40) return json({ error: "Write at least 40 words so Capy has enough language to assess." }, 422);

  const apiKey = (env as unknown as { OPENAI_API_KEY?: string }).OPENAI_API_KEY;
  if (!apiKey) return json({ error: "AI feedback is not configured yet." }, 503);

  const taskCriterion = body.task === 1 ? "Task Achievement" : "Task Response";
  const minimumWords = body.task === 1 ? 150 : 250;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        reasoning: { effort: "low" },
        max_output_tokens: 1700,
        input: [
          {
            role: "developer",
            content: [{
              type: "input_text",
              text: `You are a supportive IELTS Academic Writing practice coach. Assess the response using the four public IELTS Writing criteria: ${taskCriterion}, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy. This is Writing Task ${body.task}; the official minimum is ${minimumWords} words. If the student submitted a shorter practice draft, assess only the evidence present and clearly prioritise completion. Use half-band increments. For Task 1, never reward invented data or opinions and check for a clear overview. For Task 2, check that every part of the question is answered with a developed position and relevant support. Be specific, concise and encouraging. Never claim this is an official IELTS result. In correctedExcerpt, improve a representative portion without rewriting the whole response.`,
            }],
          },
          {
            role: "user",
            content: [{
              type: "input_text",
              text: `Lesson type: ${body.lessonId}\nTask: ${body.task}\nQuestion and source information:\n${body.prompt}\n\nStudent response (${wordCount} words):\n${essay}`,
            }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "ielts_writing_feedback",
            strict: true,
            schema: feedbackSchema,
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`Writing assessment failed with ${response.status}`);
    const payload = await response.json() as OpenAIOutput;
    const text = outputText(payload);
    if (!text) throw new Error("Writing assessment returned no structured output");
    const feedback = JSON.parse(text) as WritingFeedback;

    await saveAiPracticeAssessment({
      userEmail: user.email,
      skill: "Writing",
      lessonId: body.lessonId,
      lessonTitle: `Writing ${body.lessonId.replaceAll("-", " ")}`,
      overallBand: feedback.overallBand,
      criteria: [feedback.taskAchievement, feedback.coherence, feedback.lexicalResource, feedback.grammar],
      summary: feedback.summary,
      strengths: feedback.strengths,
      priorities: feedback.priorities,
      wordCount,
    });

    // Only structured scores and coaching points are retained. The essay itself is not stored.
    return json({ feedback, wordCount, disclaimer: "Practice estimate only — not an official IELTS band score." });
  } catch (error) {
    console.error("Writing feedback request failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Capy could not assess this writing right now. Please try again in a moment." }, 502);
  }
}
