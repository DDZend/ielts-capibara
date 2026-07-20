import type { CourseExercise, ExerciseType } from "./exercise-types";

export type MockSkill = "Reading" | "Listening" | "Writing" | "Speaking";

export type MockExamItem = CourseExercise & {
  key: string;
  skill: MockSkill;
  lessonId: string;
  lessonTitle: string;
  sourceText: string;
  audioMediaId: number | null;
  listeningScript: string;
  part: number | null;
};

export type MockVersionSummary = {
  id: number;
  testId: number;
  testTitle: string;
  label: string;
  status: string;
  readingMinutes: number;
  listeningMinutes: number;
  writingMinutes: number;
  speakingMinutes: number;
  itemCount: number;
  counts: Record<MockSkill, number>;
};

export type MockAttemptSummary = {
  id: number;
  testTitle: string;
  versionLabel: string;
  status: string;
  overallBand: number | null;
  readingBand: number | null;
  listeningBand: number | null;
  writingBand: number | null;
  speakingBand: number | null;
  submittedAt: string | null;
  startedAt: string;
  teacherComment: string;
};

export type MockMistakeReview = {
  itemKey: string;
  skill: MockSkill;
  questionType: ExerciseType;
  title: string;
  correct: boolean | null;
  studentAnswer: unknown;
  correctAnswer: unknown;
  feedback: string;
};

export type StudentMockAttempt = {
  id: number;
  testTitle: string;
  versionLabel: string;
  status: string;
  examMode: boolean;
  currentItemIndex: number;
  currentSection: MockSkill;
  sectionStartedAt: string;
  answers: Record<string, unknown>;
  items: MockExamItem[];
  durations: Record<MockSkill, number>;
  startedAt: string;
  updatedAt: string;
  assessments: Record<string, { aiBand: number | null; teacherBand: number | null; complete: boolean }>;
};

export type StudentMockSnapshot = {
  available: MockVersionSummary | null;
  activeAttempt: StudentMockAttempt | null;
  history: MockAttemptSummary[];
  previousComparison: { current: MockAttemptSummary; previous: MockAttemptSummary | null; change: number | null } | null;
  mistakes: MockMistakeReview[];
  completedThisWeek: boolean;
};

export const MOCK_SKILLS: MockSkill[] = ["Reading", "Listening", "Writing", "Speaking"];

export const DEFAULT_MOCK_DURATIONS: Record<MockSkill, number> = {
  Reading: 60,
  Listening: 40,
  Writing: 60,
  Speaking: 15,
};

export function parseMockItems(value: string): MockExamItem[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isMockExamItem) : [];
  } catch {
    return [];
  }
}

export function isMockExamItem(value: unknown): value is MockExamItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<MockExamItem>;
  return typeof item.key === "string"
    && typeof item.id === "string"
    && MOCK_SKILLS.includes(item.skill as MockSkill)
    && typeof item.lessonId === "string"
    && typeof item.lessonTitle === "string"
    && typeof item.type === "string";
}

export function countMockItems(items: MockExamItem[]) {
  return MOCK_SKILLS.reduce<Record<MockSkill, number>>((counts, skill) => {
    counts[skill] = items.filter((item) => item.skill === skill).length;
    return counts;
  }, { Reading: 0, Listening: 0, Writing: 0, Speaking: 0 });
}

export function publicMockItem(item: MockExamItem, revealAnswers = false): MockExamItem {
  return {
    ...item,
    options: revealAnswers ? item.options : item.type === "matching"
      ? item.pairs.map((pair) => pair.right)
      : item.type === "categorisation"
        ? item.categories.flatMap((category) => category.items)
        : item.options,
    correctAnswers: revealAnswers ? item.correctAnswers : [],
    pairs: revealAnswers ? item.pairs : item.pairs.map((pair) => ({ left: pair.left, right: "" })),
    categories: revealAnswers ? item.categories : item.categories.map((category) => ({ name: category.name, items: [] })),
    sampleAnswer: revealAnswers ? item.sampleAnswer : "",
    sourceText: item.skill === "Reading" ? item.sourceText : "",
    listeningScript: item.skill === "Listening" ? item.listeningScript : "",
  };
}

export function normaliseAnswer(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : value;
}

export function scoreObjectiveItem(item: MockExamItem, answer: unknown): { correct: boolean; score: number } {
  if (item.type === "multiple-choice") {
    const actual = Array.isArray(answer) ? answer.map(normaliseAnswer).sort() : [];
    const expected = item.correctAnswers.map(normaliseAnswer).sort();
    const correct = JSON.stringify(actual) === JSON.stringify(expected);
    return { correct, score: correct ? 1 : 0 };
  }
  if (item.type === "matching") {
    const actual = answer && typeof answer === "object" ? answer as Record<string, unknown> : {};
    const correct = item.pairs.every((pair) => normaliseAnswer(actual[pair.left]) === normaliseAnswer(pair.right));
    return { correct, score: correct ? 1 : 0 };
  }
  if (item.type === "categorisation") {
    const actual = answer && typeof answer === "object" ? answer as Record<string, unknown> : {};
    const correct = item.categories.every((category) => category.items.every((entry) => normaliseAnswer(actual[entry]) === normaliseAnswer(category.name)));
    return { correct, score: correct ? 1 : 0 };
  }
  if (item.type === "ordering") {
    const actual = Array.isArray(answer) ? answer.map(normaliseAnswer) : [];
    const expected = item.options.map(normaliseAnswer);
    const correct = JSON.stringify(actual) === JSON.stringify(expected);
    return { correct, score: correct ? 1 : 0 };
  }
  const actual = normaliseAnswer(answer);
  const accepted = item.correctAnswers.map(normaliseAnswer);
  const correct = accepted.includes(actual);
  return { correct, score: correct ? 1 : 0 };
}

export function objectiveBand(correct: number, total: number) {
  if (!total) return 0;
  const scaled = Math.round(correct / total * 40);
  if (scaled >= 39) return 9;
  if (scaled >= 37) return 8.5;
  if (scaled >= 35) return 8;
  if (scaled >= 33) return 7.5;
  if (scaled >= 30) return 7;
  if (scaled >= 27) return 6.5;
  if (scaled >= 23) return 6;
  if (scaled >= 19) return 5.5;
  if (scaled >= 15) return 5;
  if (scaled >= 13) return 4.5;
  return scaled >= 10 ? 4 : 3.5;
}

export function roundIeltsBand(value: number) {
  return Math.max(0, Math.min(9, Math.round(value * 2) / 2));
}

export function overallMockBand(bands: Array<number | null | undefined>) {
  const valid = bands.filter((band): band is number => typeof band === "number" && band > 0);
  return valid.length === 4 ? roundIeltsBand(valid.reduce((sum, band) => sum + band, 0) / 4) : null;
}

export function isExtendedMockType(type: ExerciseType) {
  return type === "essay-response" || type === "paragraph-response" || type === "speaking-response";
}
