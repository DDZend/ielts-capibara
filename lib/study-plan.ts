import type { Skill } from "./assessment";

export type StudyTaskTemplate = {
  skill: Skill;
  title: string;
  minutes: number;
  taskType: string;
};

const templates: Record<Skill, StudyTaskTemplate[]> = {
  Speaking: [
    { skill: "Speaking", title: "Long-turn structure", minutes: 15, taskType: "Core lesson" },
    { skill: "Speaking", title: "Fluency shadowing", minutes: 10, taskType: "Guided practice" },
    { skill: "Speaking", title: "Part 3 opinion ladder", minutes: 12, taskType: "Practice prompt" },
  ],
  Writing: [
    { skill: "Writing", title: "Contrast sentence control", minutes: 18, taskType: "Guided task" },
    { skill: "Writing", title: "Task 2 idea planning", minutes: 15, taskType: "Core lesson" },
    { skill: "Writing", title: "Cohesion edit drill", minutes: 12, taskType: "Review" },
  ],
  Reading: [
    { skill: "Reading", title: "Matching headings", minutes: 12, taskType: "Timed practice" },
    { skill: "Reading", title: "True, false, not given", minutes: 14, taskType: "Accuracy drill" },
    { skill: "Reading", title: "Fast paragraph mapping", minutes: 10, taskType: "Strategy lesson" },
  ],
  Listening: [
    { skill: "Listening", title: "Signpost word sprint", minutes: 12, taskType: "Listening set" },
    { skill: "Listening", title: "Names and numbers", minutes: 10, taskType: "Accuracy drill" },
    { skill: "Listening", title: "Map labelling cues", minutes: 14, taskType: "Guided practice" },
  ],
};

export const isoDate = (date = new Date()) => date.toISOString().slice(0, 10);

export function weekStart(date = new Date()) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return isoDate(value);
}

export function weekEnd(date = new Date()) {
  const start = new Date(`${weekStart(date)}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() + 6);
  return isoDate(start);
}

export function createDailyPlan(priority: Skill, date = new Date()): StudyTaskTemplate[] {
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  const others = (["Speaking", "Writing", "Reading", "Listening"] as Skill[]).filter((skill) => skill !== priority);
  return [
    templates[priority][dayIndex % templates[priority].length],
    templates[others[dayIndex % others.length]][(dayIndex + 1) % 3],
    templates[others[(dayIndex + 1) % others.length]][(dayIndex + 2) % 3],
  ];
}

export function isWeekend(date = new Date()) {
  return date.getUTCDay() === 0 || date.getUTCDay() === 6;
}
