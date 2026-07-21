import type { CourseModule } from "./course-catalog";

export const TUTOR_LANGUAGES = ["en", "ru", "kk"] as const;
export type TutorLanguage = (typeof TUTOR_LANGUAGES)[number];
export type TutorRole = "student" | "capi" | "teacher";

export type TutorCitation = { module: CourseModule; lessonId: string; title: string; href: string };
export type TutorPractice = { title: string; instructions: string; prompt: string; durationMinutes: number; successCriteria: string[] };

export type TutorMessageView = {
  id: number; role: TutorRole; content: string; language: TutorLanguage; intent: string;
  citations: TutorCitation[]; practice: TutorPractice | null; confidence: number | null;
  escalationRequired: boolean; createdAt: string;
};

export type TutorUsage = { planId: string; planLabel: string; used: number; limit: number; remaining: number; resetsAt: string };

export function isTutorLanguage(value: unknown): value is TutorLanguage {
  return typeof value === "string" && TUTOR_LANGUAGES.includes(value as TutorLanguage);
}

export function tutorLimitForPlan(planId: string | null) {
  if (planId?.startsWith("platinum")) return { limit: 60, label: "Platinum" };
  if (planId?.startsWith("gold")) return { limit: 40, label: "Gold" };
  if (planId?.startsWith("silver")) return { limit: 25, label: "Silver" };
  if (planId === "starter_week") return { limit: 12, label: "Starter" };
  if (planId === "sponsored") return { limit: 8, label: "Sponsored pass" };
  return { limit: 8, label: "Platform access" };
}

export function lessonHref(module: CourseModule, lessonId: string) {
  return `/${module.toLowerCase()}?lesson=${encodeURIComponent(lessonId)}`;
}

export const TUTOR_STARTERS: Record<TutorLanguage, string[]> = {
  en: ["Explain my latest Reading mistake.", "Give me a 10-minute Speaking practice.", "Improve this sentence to Band 7: ", "What should I study today?"],
  ru: ["Объясни мою последнюю ошибку в Reading.", "Дай мне 10-минутную практику Speaking.", "Улучши это предложение до Band 7: ", "Что мне сегодня изучать?"],
  kk: ["Reading бөліміндегі соңғы қатемді түсіндір.", "Маған 10 минуттық Speaking жаттығуын бер.", "Осы сөйлемді Band 7 деңгейіне жақсарт: ", "Бүгін нені оқуым керек?"],
};

export const EXAM_SAFETY_MESSAGES: Record<TutorLanguage, string> = {
  en: "Your mock test is still in secure exam mode, so I can’t explain questions or reveal answers yet. Finish and submit the mock first; then I can review your mistakes and teach the strategy behind them.",
  ru: "Сейчас ваш пробный тест проходит в защищённом экзаменационном режиме, поэтому я не могу объяснять вопросы или показывать ответы. Сначала завершите и отправьте тест — после этого я помогу разобрать ошибки и стратегии.",
  kk: "Сынақ тестіңіз қазір қорғалған емтихан режимінде, сондықтан сұрақтарды түсіндіріп немесе жауаптарды көрсете алмаймын. Алдымен тестті аяқтап, жіберіңіз — содан кейін қателер мен стратегияларды бірге талдаймыз.",
};
