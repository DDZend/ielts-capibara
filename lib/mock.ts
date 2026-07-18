import { clamp, roundHalf, skills, type Skill } from "./assessment";

export type MockPayload = {
  overallBand: number;
  speakingBand: number;
  writingBand: number;
  readingBand: number;
  listeningBand: number;
  prioritySkill: Skill;
  strengthSkill: Skill;
  readingCorrect: number;
  listeningCorrect: number;
  writingWords: number;
  speakingConfidence: number;
};

export type SavedMock = MockPayload & {
  id: number;
  weekStart: string;
  createdAt: string;
};

export function calculateMock(input: {
  readingCorrect: number;
  listeningCorrect: number;
  writingText: string;
  speakingConfidence: number;
  recordingCompleted: boolean;
}): MockPayload {
  const words = input.writingText.trim().split(/\s+/).filter(Boolean);
  const lower = input.writingText.toLowerCase();
  const links = ["however", "although", "whereas", "therefore", "moreover", "while", "because", "in contrast"];
  const readingBand = roundHalf(clamp(4.5 + input.readingCorrect / 5 * 3, 4.5, 8));
  const listeningBand = roundHalf(clamp(4.5 + input.listeningCorrect / 5 * 3, 4.5, 8));
  const writingBand = roundHalf(clamp(4.5 + (words.length >= 140 ? 1.5 : words.length >= 100 ? 1 : .5) + (links.filter((link) => lower.includes(link)).length >= 2 ? .5 : .25), 4.5, 6.5));
  const speakingBand = roundHalf(clamp(4 + input.speakingConfidence * .5 + (input.recordingCompleted ? .5 : 0), 4.5, 7));
  const bands: Record<Skill, number> = { Speaking: speakingBand, Writing: writingBand, Reading: readingBand, Listening: listeningBand };
  const ordered = [...skills].sort((a, b) => bands[a] - bands[b]);
  return {
    overallBand: roundHalf((speakingBand + writingBand + readingBand + listeningBand) / 4),
    speakingBand,
    writingBand,
    readingBand,
    listeningBand,
    prioritySkill: ordered[0],
    strengthSkill: ordered[ordered.length - 1],
    readingCorrect: input.readingCorrect,
    listeningCorrect: input.listeningCorrect,
    writingWords: words.length,
    speakingConfidence: input.speakingConfidence,
  };
}

export function isMockPayload(value: unknown): value is MockPayload {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["overallBand", "speakingBand", "writingBand", "readingBand", "listeningBand", "readingCorrect", "listeningCorrect", "writingWords", "speakingConfidence"].every((key) => Number.isFinite(item[key]))
    && skills.includes(item.prioritySkill as Skill)
    && skills.includes(item.strengthSkill as Skill);
}
