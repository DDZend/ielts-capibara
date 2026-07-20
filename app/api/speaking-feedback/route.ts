import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { getApiLearningUser } from "../../learning-access";
import { saveAiPracticeAssessment } from "../../../db";

export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 512 * 1024;
const VALID_PARTS = new Set(["part1", "part2", "part3"]);

const feedbackSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overallBand: { type: "number", minimum: 1, maximum: 9 },
    fluency: { type: "number", minimum: 1, maximum: 9 },
    lexicalResource: { type: "number", minimum: 1, maximum: 9 },
    grammar: { type: "number", minimum: 1, maximum: 9 },
    pronunciation: { type: "number", minimum: 1, maximum: 9 },
    summary: { type: "string", maxLength: 420 },
    strengths: { type: "array", items: { type: "string", maxLength: 180 }, minItems: 2, maxItems: 3 },
    priorities: { type: "array", items: { type: "string", maxLength: 180 }, minItems: 2, maxItems: 3 },
    improvedAnswer: { type: "string", maxLength: 900 },
    usefulPhrases: { type: "array", items: { type: "string", maxLength: 100 }, minItems: 3, maxItems: 5 },
  },
  required: ["overallBand", "fluency", "lexicalResource", "grammar", "pronunciation", "summary", "strengths", "priorities", "improvedAnswer", "usefulPhrases"],
} as const;

type OpenAIOutput = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

type SpeakingFeedback = {
  overallBand: number;
  fluency: number;
  lexicalResource: number;
  grammar: number;
  pronunciation: number;
  summary: string;
  strengths: string[];
  priorities: string[];
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
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

export async function POST(request: NextRequest) {
  const access = await getApiLearningUser();
  if (!access.user) return json({ error: access.status === 401 ? "Authentication required" : "Active learning access required" }, access.status);
  const user = access.user;

  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_REQUEST_BYTES) {
    return json({ error: "Recording is too large. Keep it under 8 MB." }, 413);
  }

  const data = await request.formData().catch(() => null);
  const audio = data?.get("audio");
  const part = data?.get("part");
  const prompt = data?.get("prompt");

  if (!(audio instanceof File) || !audio.type.startsWith("audio/") || audio.size < 500) {
    return json({ error: "Please attach a valid audio recording." }, 400);
  }
  if (audio.size > MAX_AUDIO_BYTES) return json({ error: "Recording is too large. Keep it under 8 MB." }, 413);
  if (typeof part !== "string" || !VALID_PARTS.has(part)) return json({ error: "Invalid Speaking part." }, 400);
  if (typeof prompt !== "string" || prompt.trim().length < 10 || prompt.length > 700) {
    return json({ error: "Invalid practice prompt." }, 400);
  }

  const apiKey = (env as unknown as { OPENAI_API_KEY?: string }).OPENAI_API_KEY;
  if (!apiKey) return json({ error: "AI feedback is not configured yet." }, 503);

  try {
    const transcriptionForm = new FormData();
    transcriptionForm.set("file", audio, audio.name || "speaking-practice.webm");
    transcriptionForm.set("model", "gpt-4o-transcribe");
    transcriptionForm.set("response_format", "json");
    transcriptionForm.set("prompt", "This is an IELTS Academic Speaking practice response in English. Preserve natural wording, hesitations and self-corrections.");

    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: transcriptionForm,
    });
    if (!transcriptionResponse.ok) throw new Error(`Transcription failed with ${transcriptionResponse.status}`);
    const transcription = await transcriptionResponse.json() as { text?: string };
    const transcript = transcription.text?.trim();
    if (!transcript || transcript.length < 3) return json({ error: "I could not hear enough English to assess. Please record again in a quieter place." }, 422);

    const assessmentResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        reasoning: { effort: "low" },
        max_output_tokens: 1400,
        input: [
          {
            role: "developer",
            content: [{
              type: "input_text",
              text: "You are a supportive IELTS Academic Speaking practice coach. Assess only the supplied response against the four public IELTS Speaking criteria: fluency and coherence, lexical resource, grammatical range and accuracy, and pronunciation. Because you receive a transcript rather than acoustic features, make the pronunciation score conservative and explain that it is a clarity estimate based on recognisability, not a full acoustic evaluation. Use half-band increments. Give specific, concise, actionable feedback. Never claim this is an official IELTS result.",
            }],
          },
          {
            role: "user",
            content: [{
              type: "input_text",
              text: `Speaking section: ${part}\nPractice question: ${prompt.trim()}\nStudent transcript:\n${transcript.slice(0, 6000)}`,
            }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "ielts_speaking_feedback",
            strict: true,
            schema: feedbackSchema,
          },
        },
      }),
    });
    if (!assessmentResponse.ok) throw new Error(`Assessment failed with ${assessmentResponse.status}`);
    const assessmentPayload = await assessmentResponse.json() as OpenAIOutput;
    const assessmentText = outputText(assessmentPayload);
    if (!assessmentText) throw new Error("Assessment returned no structured output");
    const feedback = JSON.parse(assessmentText) as SpeakingFeedback;

    await saveAiPracticeAssessment({
      userEmail: user.email,
      skill: "Speaking",
      lessonId: part,
      lessonTitle: `Speaking ${part.replace("part", "Part ")}`,
      overallBand: feedback.overallBand,
      criteria: [feedback.fluency, feedback.lexicalResource, feedback.grammar, feedback.pronunciation],
      summary: feedback.summary,
      strengths: feedback.strengths,
      priorities: feedback.priorities,
    });

    // Only structured scores and coaching points are retained. Audio and transcript remain temporary.
    return json({ transcript, feedback, disclaimer: "Practice estimate only — not an official IELTS band score." });
  } catch (error) {
    console.error("Speaking feedback request failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Capi could not assess this recording right now. Please try again in a moment." }, 502);
  }
}
