export const skills = ["Speaking", "Writing", "Reading", "Listening"] as const;
export type Skill = (typeof skills)[number];

export type AssessmentPayload = {
  targetBand: number;
  examTiming: string;
  currentLevel: string;
  weeklyHours: string;
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

export type SavedAssessment = AssessmentPayload & {
  id: number;
  userName: string;
  createdAt: string;
};

export const roundHalf = (value: number) => Math.round(value * 2) / 2;
export const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function calculateAssessment(input: {
  targetBand: number;
  examTiming: string;
  currentLevel: string;
  weeklyHours: string;
  readingCorrect: number;
  listeningCorrect: number;
  writingText: string;
  speakingConfidence: number;
  recordingCompleted: boolean;
}): AssessmentPayload {
  const readingBand = roundHalf(clamp(4.5 + (input.readingCorrect / 3) * 2.5, 4.5, 7));
  const listeningBand = roundHalf(clamp(4.5 + (input.listeningCorrect / 3) * 2.5, 4.5, 7));
  const words = input.writingText.trim().split(/\s+/).filter(Boolean);
  const lower = input.writingText.toLowerCase();
  const linkingWords = ["however", "although", "whereas", "therefore", "moreover", "while", "because", "on the other hand"];
  const linkBonus = linkingWords.filter((word) => lower.includes(word)).length >= 2 ? 0.5 : linkingWords.some((word) => lower.includes(word)) ? 0.25 : 0;
  const lengthBonus = words.length >= 90 ? 1 : words.length >= 65 ? 0.75 : words.length >= 40 ? 0.5 : 0;
  const writingBand = roundHalf(Math.min(6, 4.5 + lengthBonus + linkBonus));
  const speakingBand = roundHalf(clamp(4 + input.speakingConfidence * 0.5 + (input.recordingCompleted ? 0.25 : 0), 4.5, 7));
  const bands: Record<Skill, number> = {
    Speaking: speakingBand,
    Writing: writingBand,
    Reading: readingBand,
    Listening: listeningBand,
  };
  const ordered = [...skills].sort((a, b) => bands[a] - bands[b]);
  return {
    targetBand: input.targetBand,
    examTiming: input.examTiming,
    currentLevel: input.currentLevel,
    weeklyHours: input.weeklyHours,
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

export function isAssessmentPayload(value: unknown): value is AssessmentPayload {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const numeric = ["targetBand", "overallBand", "speakingBand", "writingBand", "readingBand", "listeningBand", "readingCorrect", "listeningCorrect", "writingWords", "speakingConfidence"];
  return numeric.every((key) => Number.isFinite(item[key])) &&
    typeof item.examTiming === "string" &&
    typeof item.currentLevel === "string" &&
    typeof item.weeklyHours === "string" &&
    skills.includes(item.prioritySkill as Skill) &&
    skills.includes(item.strengthSkill as Skill);
}
