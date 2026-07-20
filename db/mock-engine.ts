import { env } from "cloudflare:workers";
import { ensureAppSchema, getD1 } from "./index";
import { weekStart } from "../lib/study-plan";
import {
  DEFAULT_MOCK_DURATIONS,
  MOCK_SKILLS,
  countMockItems,
  objectiveBand,
  overallMockBand,
  parseMockItems,
  publicMockItem,
  scoreObjectiveItem,
  type MockAttemptSummary,
  type MockExamItem,
  type MockMistakeReview,
  type MockSkill,
  type MockVersionSummary,
  type StudentMockAttempt,
  type StudentMockSnapshot,
} from "../lib/mock-engine";

type AttemptRow = {
  id: number; test_id: number; version_id: number; user_email: string; user_name: string; status: string;
  exam_mode: number; current_item_index: number; current_section: MockSkill; section_started_at: string;
  answers_json: string; reading_correct: number | null; reading_total: number | null;
  listening_correct: number | null; listening_total: number | null; reading_band: number | null;
  listening_band: number | null; writing_ai_band: number | null; speaking_ai_band: number | null;
  writing_teacher_band: number | null; speaking_teacher_band: number | null; overall_band: number | null;
  teacher_comment: string; started_at: string; updated_at: string; submitted_at: string | null;
  test_title: string; version_label: string; reading_minutes: number; listening_minutes: number;
  writing_minutes: number; speaking_minutes: number; items_json: string;
};

type VersionRow = {
  id: number; test_id: number; test_title: string; label: string; status: string;
  reading_minutes: number; listening_minutes: number; writing_minutes: number; speaking_minutes: number;
  items_json: string; published_at: string | null;
};

type ItemResultRow = {
  item_key: string; skill: MockSkill; question_type: MockExamItem["type"]; correct: number | null;
  raw_score: number; max_score: number; ai_band: number | null; teacher_band: number | null; feedback_json: string;
};

const attemptSelect = `SELECT a.*, t.title AS test_title, v.label AS version_label,
  v.reading_minutes, v.listening_minutes, v.writing_minutes, v.speaking_minutes, v.items_json
  FROM mock_attempts a JOIN mock_tests t ON t.id = a.test_id
  JOIN mock_test_versions v ON v.id = a.version_id`;

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function seededItems(variant: "A" | "B"): MockExamItem[] {
  const readingSource = variant === "A"
    ? "Urban trees do more than improve the appearance of a city. Their shade can reduce summer surface temperatures, while their roots help slow rainwater before it reaches overloaded drains. Researchers caution, however, that simply counting trees is not enough. Species choice, soil volume and long-term maintenance determine whether a planting programme survives. Cities that consult residents also tend to distribute green space more fairly, rather than concentrating it in already wealthy districts."
    : "Citizen-science projects invite members of the public to collect observations for researchers. Smartphone tools have made participation easier, but good project design still matters. Volunteers need clear instructions, and scientists must check unusual reports before including them. When these safeguards are present, large public datasets can reveal seasonal or geographical patterns that small research teams might otherwise miss. Participants also report that contributing to genuine research increases their confidence in understanding evidence.";
  const listeningScript = variant === "A"
    ? "Welcome to the riverside museum. The guided tour begins at ten fifteen beside the information desk. The ceramics gallery is temporarily closed, so the first stop will be the photography room on level two. Please leave large bags in the free lockers. The final workshop costs six pounds and must be booked before Thursday."
    : "This is a reminder about Saturday's study-skills workshop. Registration opens at eight forty-five in the east entrance, and the first session begins at nine thirty in seminar room twelve. Bring a laptop if possible, although printed materials will be available. Lunch is included, but students should bring their own water bottle. Email access requests by Wednesday evening.";
  const reading = variant === "A"
    ? [
        ["One benefit of tree roots is that they", ["slow rainwater", "increase traffic", "heat pavements"], "slow rainwater", "single-choice"],
        ["Counting trees alone guarantees a successful programme.", [], "False", "true-false-not-given"],
        ["Which factor is mentioned alongside species choice?", [], "soil volume", "short-answer"],
        ["Resident consultation may improve the fairness of green-space distribution.", [], "True", "true-false-not-given"],
        ["The main purpose is to explain why urban tree programmes need careful planning.", [], "True", "true-false-not-given"],
      ]
    : [
        ["What has made public participation easier?", ["smartphone tools", "smaller teams", "fewer safeguards"], "smartphone tools", "single-choice"],
        ["Scientists should accept every unusual report immediately.", [], "False", "true-false-not-given"],
        ["What do volunteers need from project organisers?", [], "clear instructions", "short-answer"],
        ["Large datasets can reveal geographical patterns.", [], "True", "true-false-not-given"],
        ["The writer states that all participants become professional scientists.", [], "Not Given", "true-false-not-given"],
      ];
  const listening = variant === "A"
    ? [
        ["Where does the tour begin?", ["information desk", "level two", "ceramics gallery"], "information desk"],
        ["What time does it begin?", [], "10:15"],
        ["Which room is visited first?", [], "photography room"],
        ["Where should large bags be left?", [], "lockers"],
        ["How much does the final workshop cost?", [], "six pounds"],
      ]
    : [
        ["Which entrance should students use?", [], "east entrance"],
        ["What time does the first session begin?", [], "9:30"],
        ["Which room hosts the first session?", [], "seminar room 12"],
        ["What device should students bring if possible?", [], "laptop"],
        ["When are access requests due?", [], "Wednesday evening"],
      ];
  const items: MockExamItem[] = [];
  reading.forEach(([prompt, options, answer, type], index) => items.push(baseItem({
    key: `${variant}-r-${index + 1}`, skill: "Reading", type: type as MockExamItem["type"], prompt: String(prompt),
    options: options as string[], correctAnswers: [String(answer)], sourceText: readingSource,
  })));
  listening.forEach(([prompt, options, answer], index) => items.push(baseItem({
    key: `${variant}-l-${index + 1}`, skill: "Listening", type: (options as string[]).length ? "single-choice" : "short-answer",
    prompt: String(prompt), options: options as string[], correctAnswers: [String(answer)], listeningScript,
  })));
  items.push(baseItem({
    key: `${variant}-w-1`, skill: "Writing", type: "essay-response", part: 1, maxWords: 220,
    prompt: variant === "A" ? "The chart below shows changes in how commuters travelled to a city centre between 2005 and 2025. Summarise the main features and make relevant comparisons." : "The diagrams show a public park before and after redevelopment. Summarise the main features and make relevant comparisons.",
  }));
  items.push(baseItem({
    key: `${variant}-w-2`, skill: "Writing", type: "essay-response", part: 2, maxWords: 400,
    prompt: variant === "A" ? "Some people think cities should spend more on public transport than on new roads. To what extent do you agree or disagree?" : "Some people believe university education should be free for everyone. Discuss both views and give your own opinion.",
  }));
  [1, 2, 3].forEach((part) => items.push(baseItem({
    key: `${variant}-s-${part}`, skill: "Speaking", type: "speaking-response", part, recordingSeconds: part === 2 ? 120 : 60,
    prompt: variant === "A"
      ? ["What kind of public place do you visit most often, and why?", "Describe a place in your town that has improved recently.", "How should governments decide which public spaces to improve?"][part - 1]
      : ["How do you usually learn about local events?", "Describe a skill you learned from another person.", "Do modern technologies make communities stronger or weaker?"][part - 1],
  })));
  return items;
}

function baseItem(input: Partial<MockExamItem> & Pick<MockExamItem, "key" | "skill" | "type" | "prompt">): MockExamItem {
  return {
    id: input.key,
    key: input.key,
    skill: input.skill,
    lessonId: `starter-${input.skill.toLowerCase()}`,
    lessonTitle: `Capi Mock ${input.skill}`,
    type: input.type,
    title: input.title ?? `${input.skill} question`,
    instruction: input.instruction ?? "Answer using only the information provided.",
    prompt: input.prompt,
    options: input.options ?? [],
    correctAnswers: input.correctAnswers ?? [],
    pairs: input.pairs ?? [],
    categories: input.categories ?? [],
    sampleAnswer: input.sampleAnswer ?? "",
    maxWords: input.maxWords ?? null,
    recordingSeconds: input.recordingSeconds ?? null,
    sourceText: input.sourceText ?? "",
    audioMediaId: input.audioMediaId ?? null,
    listeningScript: input.listeningScript ?? "",
    part: input.part ?? null,
  };
}

export async function ensureMockCatalog(createdBy = "system") {
  await ensureAppSchema();
  const existing = await getD1().prepare("SELECT id FROM mock_tests LIMIT 1").first<{ id: number }>();
  if (existing) return;
  const now = new Date().toISOString();
  const inserted = await getD1().prepare(`INSERT INTO mock_tests (title, description, status, created_by, created_at, updated_at)
    VALUES (?, ?, 'published', ?, ?, ?)`)
    .bind("Capi Weekend IELTS Mock", "A secure four-skill benchmark with rotating versions and weekly comparison.", createdBy, now, now).run();
  const testId = Number(inserted.meta.last_row_id);
  for (const label of ["Version A", "Version B"] as const) {
    const items = seededItems(label.endsWith("A") ? "A" : "B");
    await getD1().prepare(`INSERT INTO mock_test_versions
      (test_id, label, status, reading_minutes, listening_minutes, writing_minutes, speaking_minutes, items_json, created_by, created_at, published_at)
      VALUES (?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(testId, label, DEFAULT_MOCK_DURATIONS.Reading, DEFAULT_MOCK_DURATIONS.Listening, DEFAULT_MOCK_DURATIONS.Writing,
        DEFAULT_MOCK_DURATIONS.Speaking, JSON.stringify(items), createdBy, now, now).run();
  }
}

function versionSummary(row: VersionRow): MockVersionSummary {
  const items = parseMockItems(row.items_json);
  return {
    id: row.id, testId: row.test_id, testTitle: row.test_title, label: row.label, status: row.status,
    readingMinutes: row.reading_minutes, listeningMinutes: row.listening_minutes,
    writingMinutes: row.writing_minutes, speakingMinutes: row.speaking_minutes,
    itemCount: items.length, counts: countMockItems(items),
  };
}

function attemptSummary(row: AttemptRow): MockAttemptSummary {
  return {
    id: row.id, testTitle: row.test_title, versionLabel: row.version_label, status: row.status,
    overallBand: row.overall_band, readingBand: row.reading_band, listeningBand: row.listening_band,
    writingBand: row.writing_teacher_band ?? row.writing_ai_band,
    speakingBand: row.speaking_teacher_band ?? row.speaking_ai_band,
    submittedAt: row.submitted_at, startedAt: row.started_at, teacherComment: row.teacher_comment,
  };
}

async function attemptAssessments(attemptId: number) {
  const rows = await getD1().prepare("SELECT item_key, ai_band, teacher_band FROM mock_item_results WHERE attempt_id = ?")
    .bind(attemptId).all<{ item_key: string; ai_band: number | null; teacher_band: number | null }>();
  return Object.fromEntries((rows.results ?? []).map((row) => [row.item_key, {
    aiBand: row.ai_band, teacherBand: row.teacher_band, complete: row.ai_band !== null || row.teacher_band !== null,
  }]));
}

function studentAttempt(row: AttemptRow, assessments: StudentMockAttempt["assessments"]): StudentMockAttempt {
  const reveal = row.status === "submitted" || row.status === "reviewed";
  return {
    id: row.id, testTitle: row.test_title, versionLabel: row.version_label, status: row.status,
    examMode: Boolean(row.exam_mode), currentItemIndex: row.current_item_index,
    currentSection: row.current_section, sectionStartedAt: row.section_started_at,
    answers: parseObject(row.answers_json), items: parseMockItems(row.items_json).map((item) => publicMockItem(item, reveal)),
    durations: { Reading: row.reading_minutes, Listening: row.listening_minutes, Writing: row.writing_minutes, Speaking: row.speaking_minutes },
    startedAt: row.started_at, updatedAt: row.updated_at, assessments,
  };
}

async function loadAttempt(where: string, values: unknown[]) {
  return getD1().prepare(`${attemptSelect} WHERE ${where} LIMIT 1`).bind(...values).first<AttemptRow>();
}

export async function getOwnedMockAttempt(email: string, attemptId: number) {
  await ensureMockCatalog();
  return loadAttempt("a.id = ? AND a.user_email = ?", [attemptId, email]);
}

export async function getStudentMockSnapshot(email: string): Promise<StudentMockSnapshot> {
  await ensureMockCatalog();
  const [active, versions, historyRows] = await Promise.all([
    loadAttempt("a.user_email = ? AND a.status = 'in_progress' ORDER BY a.updated_at DESC", [email]),
    getD1().prepare(`SELECT v.*, t.title AS test_title FROM mock_test_versions v JOIN mock_tests t ON t.id = v.test_id
      WHERE v.status = 'published' AND t.status = 'published' ORDER BY v.published_at DESC`).all<VersionRow>(),
    getD1().prepare(`${attemptSelect} WHERE a.user_email = ? AND a.status IN ('submitted','reviewed') ORDER BY a.submitted_at DESC LIMIT 12`)
      .bind(email).all<AttemptRow>(),
  ]);
  const history = (historyRows.results ?? []).map(attemptSummary);
  const latestRow = (historyRows.results ?? [])[0];
  let mistakes: MockMistakeReview[] = [];
  if (latestRow) {
    const items = parseMockItems(latestRow.items_json);
    const answers = parseObject(latestRow.answers_json);
    const results = await getD1().prepare("SELECT item_key, skill, question_type, correct, feedback_json FROM mock_item_results WHERE attempt_id = ? ORDER BY id")
      .bind(latestRow.id).all<ItemResultRow>();
    mistakes = (results.results ?? []).flatMap((result) => {
      const item = items.find((candidate) => candidate.key === result.item_key);
      if (!item || (result.correct === 1 && result.ai_band === null)) return [];
      const feedback = parseObject(result.feedback_json);
      return [{
        itemKey: item.key, skill: item.skill, questionType: item.type, title: item.title,
        correct: result.correct === null ? null : Boolean(result.correct), studentAnswer: answers[item.key],
        correctAnswer: item.correctAnswers.length ? item.correctAnswers
          : item.type === "matching" ? item.pairs
            : item.type === "categorisation" ? item.categories
              : item.type === "ordering" ? item.options
                : item.sampleAnswer || null,
        feedback: typeof feedback.summary === "string" ? feedback.summary : "Review this question and try the same task type again.",
      }];
    });
  }
  const current = history[0] ?? null;
  const previous = history[1] ?? null;
  const currentWeek = weekStart();
  return {
    available: (versions.results ?? [])[0] ? versionSummary((versions.results ?? [])[0]) : null,
    activeAttempt: active ? studentAttempt(active, await attemptAssessments(active.id)) : null,
    history,
    previousComparison: current ? { current, previous, change: current.overallBand !== null && previous?.overallBand !== null ? Number((current.overallBand - previous.overallBand).toFixed(1)) : null } : null,
    mistakes,
    completedThisWeek: history.some((attempt) => Boolean(attempt.submittedAt && attempt.submittedAt.slice(0, 10) >= currentWeek)),
  };
}

export async function startMockAttempt(email: string, userName: string) {
  await ensureMockCatalog();
  const active = await loadAttempt("a.user_email = ? AND a.status = 'in_progress' ORDER BY a.updated_at DESC", [email]);
  if (active) return studentAttempt(active, await attemptAssessments(active.id));
  const already = await getD1().prepare("SELECT id FROM mock_attempts WHERE user_email = ? AND status IN ('submitted','reviewed') AND submitted_at >= ? LIMIT 1")
    .bind(email, `${weekStart()}T00:00:00.000Z`).first<{ id: number }>();
  if (already) throw new Error("Your weekly mock is complete. A fresh version unlocks next weekend.");
  const versions = await getD1().prepare(`SELECT v.*, t.title AS test_title FROM mock_test_versions v JOIN mock_tests t ON t.id = v.test_id
    WHERE v.status = 'published' AND t.status = 'published' ORDER BY v.id`).all<VersionRow>();
  const choices = versions.results ?? [];
  if (!choices.length) throw new Error("No mock test is published yet.");
  const count = await getD1().prepare("SELECT COUNT(*) AS total FROM mock_attempts WHERE user_email = ?").bind(email).first<{ total: number }>();
  const version = choices[Number(count?.total ?? 0) % choices.length];
  const now = new Date().toISOString();
  const firstSkill = parseMockItems(version.items_json)[0]?.skill ?? "Reading";
  const inserted = await getD1().prepare(`INSERT INTO mock_attempts
    (test_id, version_id, user_email, user_name, status, exam_mode, current_item_index, current_section, section_started_at, answers_json, started_at, updated_at)
    VALUES (?, ?, ?, ?, 'in_progress', 1, 0, ?, ?, '{}', ?, ?)`)
    .bind(version.test_id, version.id, email, userName, firstSkill, now, now, now).run();
  const row = await loadAttempt("a.id = ? AND a.user_email = ?", [Number(inserted.meta.last_row_id), email]);
  if (!row) throw new Error("Could not start this mock.");
  return studentAttempt(row, {});
}

export async function autosaveMockAttempt(input: {
  email: string; attemptId: number; answers: Record<string, unknown>; currentItemIndex: number; currentSection: MockSkill;
}) {
  const attempt = await getOwnedMockAttempt(input.email, input.attemptId);
  if (!attempt || attempt.status !== "in_progress") throw new Error("This mock is no longer open.");
  const items = parseMockItems(attempt.items_json);
  if (input.currentItemIndex < 0 || input.currentItemIndex >= items.length || !MOCK_SKILLS.includes(input.currentSection)) throw new Error("Invalid exam position.");
  const allowedKeys = new Set(items.map((item) => item.key));
  const answers = Object.fromEntries(Object.entries(input.answers).filter(([key]) => allowedKeys.has(key)));
  const serialised = JSON.stringify(answers);
  if (serialised.length > 150_000) throw new Error("This saved response is too large.");
  const now = new Date().toISOString();
  const sectionChanged = input.currentSection !== attempt.current_section;
  await getD1().prepare(`UPDATE mock_attempts SET answers_json = ?, current_item_index = ?, current_section = ?,
    section_started_at = ?, updated_at = ? WHERE id = ? AND user_email = ? AND status = 'in_progress'`)
    .bind(serialised, input.currentItemIndex, input.currentSection, sectionChanged ? now : attempt.section_started_at, now, input.attemptId, input.email).run();
  return { savedAt: now, sectionStartedAt: sectionChanged ? now : attempt.section_started_at };
}

export async function saveMockAiAssessment(input: {
  email: string; attemptId: number; itemKey: string; aiBand: number; feedback: unknown;
}) {
  const attempt = await getOwnedMockAttempt(input.email, input.attemptId);
  if (!attempt || attempt.status !== "in_progress") throw new Error("This mock is no longer open.");
  const item = parseMockItems(attempt.items_json).find((candidate) => candidate.key === input.itemKey);
  if (!item || (item.skill !== "Writing" && item.skill !== "Speaking")) throw new Error("Invalid assessment item.");
  const now = new Date().toISOString();
  await getD1().prepare(`INSERT INTO mock_item_results
    (attempt_id, item_key, skill, question_type, correct, raw_score, max_score, ai_band, teacher_band, feedback_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, NULL, 0, 1, ?, NULL, ?, ?, ?)
    ON CONFLICT(attempt_id, item_key) DO UPDATE SET ai_band = excluded.ai_band, feedback_json = excluded.feedback_json, updated_at = excluded.updated_at`)
    .bind(input.attemptId, item.key, item.skill, item.type, input.aiBand, JSON.stringify(input.feedback).slice(0, 20_000), now, now).run();
}

export async function saveMockRecording(input: {
  email: string; attemptId: number; itemKey: string; fileName: string; contentType: string;
  sizeBytes: number; bytes: ArrayBuffer; transcript: string; feedback: unknown;
}) {
  const attempt = await getOwnedMockAttempt(input.email, input.attemptId);
  if (!attempt || attempt.status !== "in_progress") throw new Error("This mock is no longer open.");
  const item = parseMockItems(attempt.items_json).find((candidate) => candidate.key === input.itemKey && candidate.skill === "Speaking");
  if (!item) throw new Error("Invalid Speaking item.");
  const r2 = (env as unknown as { MEDIA?: R2Bucket }).MEDIA;
  if (!r2) throw new Error("Recording storage is unavailable.");
  const previous = await getD1().prepare("SELECT r2_key FROM mock_recordings WHERE attempt_id = ? AND item_key = ?")
    .bind(input.attemptId, item.key).first<{ r2_key: string }>();
  const extension = input.fileName.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "webm";
  const key = `mock-recordings/${input.email.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${input.attemptId}/${item.key}-${crypto.randomUUID()}.${extension}`;
  await r2.put(key, input.bytes, { httpMetadata: { contentType: input.contentType } });
  const now = new Date().toISOString();
  await getD1().prepare(`INSERT INTO mock_recordings
    (attempt_id, item_key, user_email, r2_key, file_name, content_type, size_bytes, transcript, ai_feedback_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(attempt_id, item_key) DO UPDATE SET r2_key = excluded.r2_key, file_name = excluded.file_name,
    content_type = excluded.content_type, size_bytes = excluded.size_bytes, transcript = excluded.transcript,
    ai_feedback_json = excluded.ai_feedback_json, created_at = excluded.created_at`)
    .bind(input.attemptId, item.key, input.email, key, input.fileName.slice(0, 160), input.contentType, input.sizeBytes,
      input.transcript.slice(0, 12_000), JSON.stringify(input.feedback).slice(0, 20_000), now).run();
  if (previous?.r2_key && previous.r2_key !== key) await r2.delete(previous.r2_key).catch(() => undefined);
}

export async function submitMockAttempt(email: string, attemptId: number) {
  const attempt = await getOwnedMockAttempt(email, attemptId);
  if (!attempt || attempt.status !== "in_progress") throw new Error("This mock is no longer open.");
  const items = parseMockItems(attempt.items_json);
  const answers = parseObject(attempt.answers_json);
  const now = new Date().toISOString();
  let readingCorrect = 0;
  let listeningCorrect = 0;
  let readingTotal = 0;
  let listeningTotal = 0;
  for (const item of items.filter((candidate) => candidate.skill === "Reading" || candidate.skill === "Listening")) {
    const result = scoreObjectiveItem(item, answers[item.key]);
    if (item.skill === "Reading") { readingTotal += 1; if (result.correct) readingCorrect += 1; }
    else { listeningTotal += 1; if (result.correct) listeningCorrect += 1; }
    await getD1().prepare(`INSERT INTO mock_item_results
      (attempt_id, item_key, skill, question_type, correct, raw_score, max_score, feedback_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, '{}', ?, ?)
      ON CONFLICT(attempt_id, item_key) DO UPDATE SET correct = excluded.correct, raw_score = excluded.raw_score, updated_at = excluded.updated_at`)
      .bind(attemptId, item.key, item.skill, item.type, result.correct ? 1 : 0, result.score, now, now).run();
  }
  const extended = await getD1().prepare("SELECT skill, ai_band, teacher_band FROM mock_item_results WHERE attempt_id = ? AND skill IN ('Writing','Speaking')")
    .bind(attemptId).all<{ skill: MockSkill; ai_band: number | null; teacher_band: number | null }>();
  const bandsFor = (skill: MockSkill) => (extended.results ?? []).filter((row) => row.skill === skill).map((row) => row.teacher_band ?? row.ai_band).filter((band): band is number => band !== null);
  const writingBands = bandsFor("Writing");
  const speakingBands = bandsFor("Speaking");
  if (!writingBands.length || !speakingBands.length) throw new Error("Complete the Writing and Speaking assessments before submitting.");
  const readingBand = objectiveBand(readingCorrect, readingTotal);
  const listeningBand = objectiveBand(listeningCorrect, listeningTotal);
  const writingAiBand = Number((writingBands.reduce((sum, band) => sum + band, 0) / writingBands.length).toFixed(1));
  const speakingAiBand = Number((speakingBands.reduce((sum, band) => sum + band, 0) / speakingBands.length).toFixed(1));
  const overallBand = overallMockBand([readingBand, listeningBand, writingAiBand, speakingAiBand]);
  await getD1().prepare(`UPDATE mock_attempts SET status = 'submitted', reading_correct = ?, reading_total = ?,
    listening_correct = ?, listening_total = ?, reading_band = ?, listening_band = ?, writing_ai_band = ?,
    speaking_ai_band = ?, overall_band = ?, submitted_at = ?, updated_at = ? WHERE id = ? AND user_email = ?`)
    .bind(readingCorrect, readingTotal, listeningCorrect, listeningTotal, readingBand, listeningBand, writingAiBand,
      speakingAiBand, overallBand, now, now, attemptId, email).run();
  const week = weekStart(new Date(now));
  const allBands: Record<MockSkill, number> = { Reading: readingBand, Listening: listeningBand, Writing: writingAiBand, Speaking: speakingAiBand };
  const ordered = [...MOCK_SKILLS].sort((a, b) => allBands[a] - allBands[b]);
  const writingWords = items.filter((item) => item.skill === "Writing").reduce((total, item) => total + String(answers[item.key] ?? "").trim().split(/\s+/).filter(Boolean).length, 0);
  await getD1().prepare(`INSERT INTO mock_results
    (user_email, user_name, week_start, overall_band, speaking_band, writing_band, reading_band, listening_band,
      priority_skill, strength_skill, reading_correct, listening_correct, writing_words, speaking_confidence, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 3, ?)
    ON CONFLICT(user_email, week_start) DO UPDATE SET overall_band = excluded.overall_band,
      speaking_band = excluded.speaking_band, writing_band = excluded.writing_band, reading_band = excluded.reading_band,
      listening_band = excluded.listening_band, priority_skill = excluded.priority_skill, strength_skill = excluded.strength_skill,
      reading_correct = excluded.reading_correct, listening_correct = excluded.listening_correct,
      writing_words = excluded.writing_words, created_at = excluded.created_at`)
    .bind(email, attempt.user_name, week, overallBand, speakingAiBand, writingAiBand, readingBand, listeningBand,
      ordered[0], ordered.at(-1), readingCorrect, listeningCorrect, writingWords, now).run();
  return getStudentMockSnapshot(email);
}

export async function createMockVersion(input: {
  teacherEmail: string; testId: number | null; title: string; description: string; label: string;
  status: "draft" | "published"; durations: Record<MockSkill, number>; items: MockExamItem[];
}) {
  await ensureMockCatalog(input.teacherEmail);
  const now = new Date().toISOString();
  let testId = input.testId;
  if (testId) {
    const existing = await getD1().prepare("SELECT id FROM mock_tests WHERE id = ?").bind(testId).first<{ id: number }>();
    if (!existing) throw new Error("Mock test not found.");
    await getD1().prepare("UPDATE mock_tests SET title = ?, description = ?, status = ?, updated_at = ? WHERE id = ?")
      .bind(input.title, input.description, input.status, now, testId).run();
  } else {
    const inserted = await getD1().prepare(`INSERT INTO mock_tests (title, description, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(input.title, input.description, input.status, input.teacherEmail, now, now).run();
    testId = Number(inserted.meta.last_row_id);
  }
  await getD1().prepare(`INSERT INTO mock_test_versions
    (test_id, label, status, reading_minutes, listening_minutes, writing_minutes, speaking_minutes, items_json, created_by, created_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(testId, input.label, input.status, input.durations.Reading, input.durations.Listening,
      input.durations.Writing, input.durations.Speaking, JSON.stringify(input.items), input.teacherEmail, now,
      input.status === "published" ? now : null).run();
}

export async function setMockVersionStatus(teacherEmail: string, versionId: number, status: "draft" | "published" | "hidden") {
  await ensureMockCatalog(teacherEmail);
  const now = new Date().toISOString();
  const version = await getD1().prepare("SELECT test_id FROM mock_test_versions WHERE id = ?").bind(versionId).first<{ test_id: number }>();
  if (!version) throw new Error("Mock version not found.");
  await getD1().prepare("UPDATE mock_test_versions SET status = ?, published_at = ? WHERE id = ?")
    .bind(status, status === "published" ? now : null, versionId).run();
  await getD1().prepare("UPDATE mock_tests SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status === "published" ? "published" : "draft", now, version.test_id).run();
}

export async function getTeacherMockDashboard() {
  await ensureMockCatalog();
  const [tests, versions, attempts, analytics] = await Promise.all([
    getD1().prepare("SELECT id, title, description, status, updated_at FROM mock_tests ORDER BY updated_at DESC").all<{ id: number; title: string; description: string; status: string; updated_at: string }>(),
    getD1().prepare(`SELECT v.*, t.title AS test_title FROM mock_test_versions v JOIN mock_tests t ON t.id = v.test_id ORDER BY v.id DESC`).all<VersionRow>(),
    getD1().prepare(`${attemptSelect} WHERE a.status IN ('submitted','reviewed') ORDER BY a.submitted_at DESC LIMIT 100`).all<AttemptRow>(),
    getD1().prepare(`SELECT skill, question_type, COUNT(*) AS attempts,
      SUM(CASE WHEN correct = 0 THEN 1 ELSE 0 END) AS mistakes
      FROM mock_item_results WHERE correct IS NOT NULL GROUP BY skill, question_type ORDER BY mistakes DESC`).all<{ skill: MockSkill; question_type: string; attempts: number; mistakes: number }>(),
  ]);
  const assessmentRows = await getD1().prepare(`SELECT attempt_id, item_key, skill, ai_band, teacher_band, feedback_json
    FROM mock_item_results WHERE attempt_id IN (SELECT id FROM mock_attempts WHERE status IN ('submitted','reviewed'))
    AND skill IN ('Writing','Speaking') ORDER BY attempt_id DESC`).all<{ attempt_id: number; item_key: string; skill: MockSkill; ai_band: number | null; teacher_band: number | null; feedback_json: string }>();
  return {
    tests: tests.results ?? [],
    versions: (versions.results ?? []).map(versionSummary),
    attempts: (attempts.results ?? []).map((row) => ({
      ...attemptSummary(row), userEmail: row.user_email, userName: row.user_name,
      assessments: (assessmentRows.results ?? []).filter((item) => item.attempt_id === row.id).map((item) => ({
        itemKey: item.item_key, skill: item.skill, aiBand: item.ai_band, teacherBand: item.teacher_band,
        feedback: parseObject(item.feedback_json),
      })),
    })),
    analytics: (analytics.results ?? []).map((row) => ({
      skill: row.skill, questionType: row.question_type, attempts: Number(row.attempts), mistakes: Number(row.mistakes),
      difficultyPercent: Number(row.attempts) ? Math.round(Number(row.mistakes) / Number(row.attempts) * 100) : 0,
    })),
  };
}

export async function moderateMockAssessment(input: {
  attemptId: number; itemKey: string; band: number; comment: string;
}) {
  await ensureMockCatalog();
  const row = await getD1().prepare("SELECT skill FROM mock_item_results WHERE attempt_id = ? AND item_key = ? AND skill IN ('Writing','Speaking')")
    .bind(input.attemptId, input.itemKey).first<{ skill: MockSkill }>();
  if (!row) throw new Error("Assessment not found.");
  const now = new Date().toISOString();
  await getD1().prepare("UPDATE mock_item_results SET teacher_band = ?, feedback_json = json_set(feedback_json, '$.teacherComment', ?), updated_at = ? WHERE attempt_id = ? AND item_key = ?")
    .bind(input.band, input.comment, now, input.attemptId, input.itemKey).run();
  const attempt = await loadAttempt("a.id = ?", [input.attemptId]);
  if (!attempt) throw new Error("Attempt not found.");
  const rows = await getD1().prepare("SELECT skill, ai_band, teacher_band FROM mock_item_results WHERE attempt_id = ? AND skill IN ('Writing','Speaking')")
    .bind(input.attemptId).all<{ skill: MockSkill; ai_band: number | null; teacher_band: number | null }>();
  const average = (skill: MockSkill) => {
    const values = (rows.results ?? []).filter((entry) => entry.skill === skill).map((entry) => entry.teacher_band ?? entry.ai_band).filter((band): band is number => band !== null);
    return values.length ? Number((values.reduce((sum, band) => sum + band, 0) / values.length).toFixed(1)) : null;
  };
  const writing = average("Writing");
  const speaking = average("Speaking");
  const overall = overallMockBand([attempt.reading_band, attempt.listening_band, writing, speaking]);
  await getD1().prepare(`UPDATE mock_attempts SET status = 'reviewed', writing_teacher_band = ?, speaking_teacher_band = ?,
    overall_band = ?, teacher_comment = ?, updated_at = ? WHERE id = ?`)
    .bind(writing, speaking, overall, input.comment, now, input.attemptId).run();
  if (attempt.submitted_at && overall !== null && writing !== null && speaking !== null) {
    await getD1().prepare(`UPDATE mock_results SET overall_band = ?, writing_band = ?, speaking_band = ?
      WHERE user_email = ? AND week_start = ?`)
      .bind(overall, writing, speaking, attempt.user_email, weekStart(new Date(attempt.submitted_at))).run();
  }
}

export async function getMockRecording(email: string, attemptId: number, itemKey: string, teacher = false) {
  await ensureMockCatalog();
  const row = await getD1().prepare(`SELECT r.r2_key, r.content_type, r.file_name FROM mock_recordings r
    JOIN mock_attempts a ON a.id = r.attempt_id WHERE r.attempt_id = ? AND r.item_key = ? ${teacher ? "" : "AND a.user_email = ?"} LIMIT 1`)
    .bind(...(teacher ? [attemptId, itemKey] : [attemptId, itemKey, email])).first<{ r2_key: string; content_type: string; file_name: string }>();
  if (!row) return null;
  const object = await (env as unknown as { MEDIA?: R2Bucket }).MEDIA?.get(row.r2_key);
  return object ? { object, contentType: row.content_type, fileName: row.file_name } : null;
}
