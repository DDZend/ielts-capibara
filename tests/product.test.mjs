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
    access(new URL("app/api/me/route.ts", root)),
    access(new URL("app/api/assessment-results/route.ts", root)),
    access(new URL("app/api/study-plan/route.ts", root)),
    access(new URL("app/api/mock-results/route.ts", root)),
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
  assert.match(dashboard, /className={`skill-card \${className}`} href="#today-plan"/);
  assert.match(styles, /\.interactive-control:hover/);
  assert.match(styles, /\.skill-card:hover/);
  assert.match(styles, /\.skill-card:focus-visible/);
});
