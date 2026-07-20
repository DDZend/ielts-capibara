import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("all requested routes are present", async () => {
  await Promise.all([
    access(new URL("app/page.tsx", root)),
    access(new URL("app/assessment/page.tsx", root)),
    access(new URL("app/dashboard/page.tsx", root)),
    access(new URL("app/mock-test/page.tsx", root)),
    access(new URL("app/speaking/page.tsx", root)),
    access(new URL("app/writing/page.tsx", root)),
    access(new URL("app/reading/page.tsx", root)),
    access(new URL("app/listening/page.tsx", root)),
    access(new URL("app/api/me/route.ts", root)),
    access(new URL("app/api/assessment-results/route.ts", root)),
    access(new URL("app/api/study-plan/route.ts", root)),
    access(new URL("app/api/mock-results/route.ts", root)),
    access(new URL("app/api/speaking-feedback/route.ts", root)),
    access(new URL("app/api/writing-feedback/route.ts", root)),
    access(new URL("app/api/capi-helper/route.ts", root)),
    access(new URL("app/api/lesson-progress/route.ts", root)),
  ]);
});

test("daily study tasks and weekly mocks are owned by the signed-in student", async () => {
  const [studyApi, mockApi] = await Promise.all([
    read("app/api/study-plan/route.ts"),
    read("app/api/mock-results/route.ts"),
  ]);
  for (const source of [studyApi, mockApi]) {
    assert.match(source, /const user = await getChatGPTUser\(\)/);
    assert.match(source, /user\.email/);
    assert.doesNotMatch(source, /body\.userEmail|body\.userName/);
  }
  assert.match(studyApi, /eq\(studyTasks\.userEmail, user\.email\)/);
  assert.match(mockApi, /eq\(mockResults\.userEmail, user\.email\)/);
});

test("dashboard and result APIs enforce platform identity on the server", async () => {
  const [dashboard, api] = await Promise.all([
    read("app/dashboard/page.tsx"),
    read("app/api/assessment-results/route.ts"),
  ]);
  assert.match(dashboard, /requireChatGPTUser\("\/dashboard"\)/);
  assert.match(api, /const user = await getChatGPTUser\(\)/);
  assert.match(api, /eq\(assessmentResults\.userEmail, user\.email\)/);
  assert.doesNotMatch(api, /body\.userEmail|body\.userName/);
});

test("only calculated metrics are persisted", async () => {
  const [schema, migration, api] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0001_safe_titania.sql"),
    read("app/api/assessment-results/route.ts"),
  ]);
  for (const source of [schema, migration]) {
    assert.doesNotMatch(source, /writing_text|writingText|audio|recording/i);
    assert.match(source, /writing_words|writingWords/);
    assert.match(source, /speaking_confidence|speakingConfidence/);
  }
  assert.doesNotMatch(api, /writingText|audio|recording/);
});

test("mock flow never persists writing text or audio", async () => {
  const [schema, mockApi, mockClient] = await Promise.all([
    read("db/schema.ts"),
    read("app/api/mock-results/route.ts"),
    read("app/mock-test/MockTestClient.tsx"),
  ]);
  assert.doesNotMatch(schema, /writingText|writing_text|audio|recording/i);
  assert.doesNotMatch(mockApi, /writingText|writing_text|audio|recording/i);
  assert.match(mockClient, /navigator\.mediaDevices\.getUserMedia/);
  assert.doesNotMatch(mockClient, /FormData|audioBlob|new Blob/);
});

test("assessment uses temporary redirect storage but no permanent browser store", async () => {
  const assessment = await read("app/assessment/AssessmentClient.tsx");
  assert.match(assessment, /sessionStorage\.setItem\(pendingKey/);
  assert.match(assessment, /sessionStorage\.removeItem\(pendingKey\)/);
  assert.doesNotMatch(assessment, /localStorage/);
  assert.match(assessment, /navigator\.mediaDevices\.getUserMedia/);
  assert.doesNotMatch(assessment, /FormData|audioBlob|new Blob/);
});

test("generated migration has required ownership index", async () => {
  const migration = await read("drizzle/0000_lucky_patch.sql");
  assert.match(migration, /CREATE TABLE `assessment_results`/);
  assert.match(migration, /assessment_results_user_email_created_at_idx/);
  assert.match(migration, /\(`user_email`,`created_at`\)/);
});

test("weekly mock migration enforces one result per user and week", async () => {
  const migration = await read("drizzle/0001_safe_titania.sql");
  assert.match(migration, /CREATE TABLE `study_tasks`/);
  assert.match(migration, /study_tasks_user_date_title_uidx/);
  assert.match(migration, /CREATE TABLE `mock_results`/);
  assert.match(migration, /mock_results_user_week_uidx/);
  assert.match(migration, /\(`user_email`,`week_start`\)/);
});

test("challenge card uses Capi checklist artwork without a calendar icon", async () => {
  const dashboard = await read("app/dashboard/DashboardClient.tsx");
  const challenge = dashboard.slice(dashboard.indexOf('className="challenge-card'), dashboard.indexOf('className="capi-advice-card'));
  assert.match(challenge, /capi-challenge\.png/);
  assert.doesNotMatch(challenge, /CalendarDays/);
});

test("dashboard topbar and skill modules expose compact interactive controls", async () => {
  const [dashboard, styles] = await Promise.all([
    read("app/dashboard/DashboardClient.tsx"),
    read("app/globals.css"),
  ]);
  for (const label of ["Eng", "Рус", "Қаз"]) assert.match(dashboard, new RegExp(`>${label}<`));
  assert.match(dashboard, /aria-controls="capi-coins-panel"/);
  assert.match(dashboard, /aria-controls="profile-panel"/);
  assert.match(dashboard, /skill === "Writing" \? "\/writing"/);
  assert.match(dashboard, /skill === "Reading" \? "\/reading"/);
  assert.match(styles, /\.interactive-control:hover/);
  assert.match(styles, /\.skill-card:hover/);
  assert.match(styles, /\.skill-card:focus-visible/);
  assert.match(dashboard, /targetOpen \? "target-open"/);
  assert.match(styles, /\.welcome-card\.target-open \{ min-height: 306px; \}/);
  assert.match(dashboard, /onChange=\{\(event\) => setLanguage/);
  assert.match(styles, /\.dashboard-language select \{ position: absolute; z-index: 2; inset: 0;/);
});

test("Capi Helper turns donated coins into persistent one-day passes for new learners", async () => {
  const [dashboard, styles, api, schema, migration] = await Promise.all([
    read("app/dashboard/DashboardClient.tsx"),
    read("app/globals.css"),
    read("app/api/capi-helper/route.ts"),
    read("db/schema.ts"),
    read("drizzle/0002_loose_stardust.sql"),
  ]);
  assert.match(dashboard, /const capiHelperGiftCost = 500/);
  for (const tier of [5, 10, 15]) assert.match(dashboard, new RegExp(`percent: ${tier}`));
  assert.match(dashboard, /Give a new student one free day/);
  assert.match(dashboard, /24-hour IELTS Mastery pass/);
  assert.match(dashboard, /Save up to 15%/);
  assert.match(dashboard, /discountTiers.*liveEarnedPoints/s);
  assert.match(styles, /\.capi-helper-reward/);
  assert.match(styles, /\.capi-helper-exchange/);
  assert.match(styles, /\.discount-tier-grid article\.unlocked/);
  assert.match(api, /const user = await getChatGPTUser\(\)/);
  assert.match(api, /const GIFT_COST = 500/);
  assert.match(api, /const ACCESS_HOURS = 24/);
  assert.match(api, /INSERT INTO capi_helper_gifts/);
  assert.match(api, /WHERE \(/);
  assert.doesNotMatch(api, /body\.donorEmail|body\.userEmail/);
  for (const source of [schema, migration]) assert.match(source, /capi_helper_gifts/);
});

test("notification and language controls share hover feedback and Reading uses yellow", async () => {
  const [dashboard, styles] = await Promise.all([
    read("app/dashboard/DashboardClient.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(dashboard, /className="notification interactive-control"/);
  assert.match(dashboard, /className="language-control dashboard-language interactive-control"/);
  assert.match(styles, /--reading: #b77900/);
  assert.match(styles, /\.skill-card\.reading \.skill-card-icon \{ color: var\(--reading\); background: #fff7d6; \}/);
});

test("speaking course is protected and links from the dashboard", async () => {
  const [page, dashboard] = await Promise.all([
    read("app/speaking/page.tsx"),
    read("app/dashboard/DashboardClient.tsx"),
  ]);
  assert.match(page, /requireChatGPTUser\("\/speaking"\)/);
  assert.match(dashboard, /skill === "Speaking" \? "\/speaking"/);
});

test("speaking AI feedback is authenticated, bounded and saves only structured coaching data", async () => {
  const [api, schema] = await Promise.all([read("app/api/speaking-feedback/route.ts"), read("db/schema.ts")]);
  assert.match(api, /const user = await getChatGPTUser\(\)/);
  assert.match(api, /MAX_AUDIO_BYTES = 8 \* 1024 \* 1024/);
  assert.match(api, /gpt-4o-transcribe/);
  assert.match(api, /gpt-5\.6-luna/);
  assert.match(api, /json_schema/);
  assert.match(api, /saveAiPracticeAssessment/);
  assert.match(api, /Audio and transcript remain temporary/);
  assert.match(schema, /aiPracticeAssessments/);
  assert.doesNotMatch(schema, /audio_blob|transcript|essay_text/);
});

test("speaking recorder uses temporary browser audio and sends it only for feedback", async () => {
  const client = await read("app/speaking/SpeakingClient.tsx");
  assert.match(client, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(client, /new MediaRecorder/);
  assert.match(client, /form\.set\("audio", audioBlob/);
  assert.match(client, /fetch\("\/api\/speaking-feedback"/);
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
});

test("speaking video spaces are reserved for the creator's future lessons", async () => {
  const client = await read("app/speaking/SpeakingClient.tsx");
  assert.match(client, /Video coming soon/);
  assert.match(client, /ready for your original explanatory video/);
  assert.doesNotMatch(client, /takeielts\.britishcouncil\.org\/teach-ielts\/teaching-resources\/videos/);
});

test("writing course is protected and exposes twelve visually grouped lessons", async () => {
  const [page, client, dashboard] = await Promise.all([
    read("app/writing/page.tsx"),
    read("app/writing/WritingClient.tsx"),
    read("app/dashboard/DashboardClient.tsx"),
  ]);
  assert.match(page, /requireChatGPTUser\("\/writing"\)/);
  assert.match(dashboard, /skill === "Writing" \? "\/writing"/);
  const lessonIds = ["line-graph", "bar-chart", "pie-chart", "table", "process", "maps-plans", "mixed-visuals", "opinion", "discussion", "advantages", "problem-solution", "two-part"];
  for (const id of lessonIds) assert.match(client, new RegExp(`id: "${id}"`));
  assert.match(client, /Seven ways visual information can be presented/);
  assert.match(client, /Five common ways the essay question can be framed/);
});

test("writing feedback saves scores and coaching without retaining the essay", async () => {
  const [api, client, schema] = await Promise.all([
    read("app/api/writing-feedback/route.ts"),
    read("app/writing/WritingClient.tsx"),
    read("db/schema.ts"),
  ]);
  assert.match(api, /const user = await getChatGPTUser\(\)/);
  assert.match(api, /MAX_ESSAY_CHARACTERS = 20_000/);
  assert.match(api, /gpt-5\.6-luna/);
  assert.match(api, /json_schema/);
  assert.match(api, /saveAiPracticeAssessment/);
  assert.match(api, /essay itself is not stored/);
  assert.doesNotMatch(schema, /essay_text|essayText|audio_blob|transcript/);
  assert.match(client, /fetch\("\/api\/writing-feedback"/);
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
});

test("reading course is protected and covers all official task types", async () => {
  const [page, client, dashboard] = await Promise.all([
    read("app/reading/page.tsx"),
    read("app/reading/ReadingClient.tsx"),
    read("app/dashboard/DashboardClient.tsx"),
  ]);
  assert.match(page, /requireChatGPTUser\("\/reading"\)/);
  assert.match(dashboard, /skill === "Reading" \? "\/reading"/);
  assert.match(dashboard, /14 strategy lessons/);
  const lessonIds = ["multiple-choice", "true-false-ng", "yes-no-ng", "matching-information", "matching-headings", "matching-features", "matching-endings", "sentence-completion", "summary-completion", "note-completion", "table-completion", "flow-chart-completion", "diagram-labelling", "short-answer"];
  for (const id of lessonIds) assert.match(client, new RegExp(`id: "${id}"`));
  assert.match(client, /Reserved for your original video/);
});

test("reading practice credits authentic sources and saves exercise results", async () => {
  const client = await read("app/reading/ReadingClient.tsx");
  for (const source of ["science.nasa.gov", "oceanservice.noaa.gov", "usgs.gov", "nps.gov", "epa.gov", "nih.gov", "energy.gov", "usda.gov"]) {
    assert.match(client, new RegExp(source.replaceAll(".", "\\.")));
  }
  assert.match(client, /Original adaptation, authentic source/);
  assert.match(client, /It is not an official IELTS passage/);
  assert.match(client, /saveLessonProgress\(\{ module: "Reading"/);
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
});

test("listening course is protected and exposes twelve lessons across four parts", async () => {
  const [page, client, dashboard] = await Promise.all([
    read("app/listening/page.tsx"),
    read("app/listening/ListeningClient.tsx"),
    read("app/dashboard/DashboardClient.tsx"),
  ]);
  assert.match(page, /requireChatGPTUser\("\/listening"\)/);
  assert.match(dashboard, /"\/listening"/);
  assert.match(dashboard, /12 audio lessons/);
  const lessonIds = ["form-completion", "spelling-numbers", "conversation-multiple-choice", "map-labelling", "matching-features", "short-answer", "matching-speakers", "attitude-multiple-choice", "sentence-completion", "lecture-notes", "table-flowchart", "summary-completion"];
  for (const id of lessonIds) assert.match(client, new RegExp(`id: "${id}"`));
  for (const part of ["part1", "part2", "part3", "part4"]) assert.match(client, new RegExp(`id: "${part}"`));
});

test("listening practice is transparent, interactive and saves exercise results", async () => {
  const client = await read("app/listening/ListeningClient.tsx");
  assert.match(client, /temporary device-voice demo/);
  assert.match(client, /window\.speechSynthesis/);
  assert.match(client, /ONE PLAY ONLY/);
  assert.match(client, /Reveal transcript and replay evidence/);
  assert.match(client, /Facts adapted from/);
  assert.match(client, /saveLessonProgress\(\{ module: "Listening"/);
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
  assert.doesNotMatch(client, /ielts\.org\/.*\.(mp3|wav)/i);
});

test("lesson progress is user-owned and the dashboard adapts the connected journey", async () => {
  const [api, db, dashboard, migration] = await Promise.all([
    read("app/api/lesson-progress/route.ts"),
    read("db/index.ts"),
    read("app/dashboard/DashboardClient.tsx"),
    read("drizzle/0003_round_mister_fear.sql"),
  ]);
  assert.match(api, /const user = await getChatGPTUser\(\)/);
  assert.match(api, /eq\(lessonProgress\.userEmail, user\.email\)/);
  assert.doesNotMatch(api, /body\.userEmail|body\.email/);
  assert.match(api, /onConflictDoUpdate/);
  assert.match(db, /const adaptivePriority = adaptiveScores/);
  assert.match(db, /createDailyPlan\(adaptivePriority/);
  assert.match(dashboard, /Connected learning journey/);
  assert.match(dashboard, /AI band history/);
  assert.match(dashboard, /Weekly progress report/);
  assert.match(dashboard, /shareWeeklyReport/);
  assert.match(migration, /CREATE TABLE `lesson_progress`/);
  assert.match(migration, /lesson_progress_user_module_lesson_uidx/);
  assert.match(migration, /CREATE TABLE `ai_practice_assessments`/);
});
