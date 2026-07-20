export const COURSE_MODULES = ["Speaking", "Writing", "Reading", "Listening"] as const;

export type CourseModule = (typeof COURSE_MODULES)[number];

export type CatalogLesson = {
  module: CourseModule;
  id: string;
  title: string;
};

const moduleLessons: Record<CourseModule, Array<[string, string]>> = {
  Speaking: [
    ["part1", "Warm, natural answers"],
    ["part2", "Build a confident long turn"],
    ["part3", "Develop deeper ideas"],
  ],
  Writing: [
    ["line-graph", "Line graphs"],
    ["bar-chart", "Bar charts"],
    ["pie-chart", "Pie charts"],
    ["table", "Tables"],
    ["process", "Process diagrams"],
    ["maps-plans", "Maps and plans"],
    ["mixed-visuals", "Mixed visuals"],
    ["opinion", "Opinion essays"],
    ["discussion", "Discussion essays"],
    ["advantages", "Advantages and disadvantages"],
    ["problem-solution", "Problems and solutions"],
    ["two-part", "Two-part questions"],
  ],
  Reading: [
    ["multiple-choice", "Multiple choice"],
    ["true-false-ng", "True, False, Not Given"],
    ["yes-no-ng", "Yes, No, Not Given"],
    ["matching-information", "Matching information"],
    ["matching-headings", "Matching headings"],
    ["matching-features", "Matching features"],
    ["matching-endings", "Matching sentence endings"],
    ["sentence-completion", "Sentence completion"],
    ["summary-completion", "Summary completion"],
    ["note-completion", "Note completion"],
    ["table-completion", "Table completion"],
    ["flow-chart-completion", "Flow-chart completion"],
    ["diagram-labelling", "Diagram labelling"],
    ["short-answer", "Short-answer questions"],
  ],
  Listening: [
    ["form-completion", "Form completion"],
    ["spelling-numbers", "Spelling, names and numbers"],
    ["conversation-multiple-choice", "Conversation multiple choice"],
    ["map-labelling", "Map and plan labelling"],
    ["matching-features", "Matching places and features"],
    ["short-answer", "Short-answer questions"],
    ["matching-speakers", "Matching speakers to opinions"],
    ["attitude-multiple-choice", "Attitude and agreement"],
    ["sentence-completion", "Sentence completion"],
    ["lecture-notes", "Academic note completion"],
    ["table-flowchart", "Table and flow-chart completion"],
    ["summary-completion", "Summary completion"],
  ],
};

export const COURSE_CATALOG: CatalogLesson[] = COURSE_MODULES.flatMap((module) =>
  moduleLessons[module].map(([id, title]) => ({ module, id, title })),
);

export function isCourseModule(value: unknown): value is CourseModule {
  return typeof value === "string" && COURSE_MODULES.includes(value as CourseModule);
}

export function catalogForModule(module: CourseModule) {
  return COURSE_CATALOG.filter((lesson) => lesson.module === module);
}
