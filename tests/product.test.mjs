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
    access(new URL("app/api/me/route.ts", root)),
    access(new URL("app/api/assessment-results/route.ts", root)),
  ]);
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
    read("drizzle/0000_lucky_patch.sql"),
    read("app/api/assessment-results/route.ts"),
  ]);
  for (const source of [schema, migration]) {
    assert.doesNotMatch(source, /writing_text|writingText|audio|recording/i);
    assert.match(source, /writing_words|writingWords/);
    assert.match(source, /speaking_confidence|speakingConfidence/);
  }
  assert.doesNotMatch(api, /writingText|audio|recording/);
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

test("challenge card uses Capi checklist artwork without a calendar icon", async () => {
  const dashboard = await read("app/dashboard/DashboardClient.tsx");
  const challenge = dashboard.slice(dashboard.indexOf('className="challenge-card'), dashboard.indexOf('className="capi-advice-card'));
  assert.match(challenge, /capi-challenge\.png/);
  assert.doesNotMatch(challenge, /CalendarDays/);
});
