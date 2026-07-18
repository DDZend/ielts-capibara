import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq } from "drizzle-orm";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export function getD1() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return env.DB;
}

let schemaReady: Promise<void> | null = null;

export function ensureAssessmentSchema() {
  schemaReady ??= getD1()
    .batch([
      getD1().prepare(`CREATE TABLE IF NOT EXISTS assessment_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        user_name TEXT NOT NULL,
        target_band REAL NOT NULL,
        exam_timing TEXT NOT NULL,
        current_level TEXT NOT NULL,
        weekly_hours TEXT NOT NULL,
        overall_band REAL NOT NULL,
        speaking_band REAL NOT NULL,
        writing_band REAL NOT NULL,
        reading_band REAL NOT NULL,
        listening_band REAL NOT NULL,
        priority_skill TEXT NOT NULL,
        strength_skill TEXT NOT NULL,
        reading_correct INTEGER NOT NULL,
        listening_correct INTEGER NOT NULL,
        writing_words INTEGER NOT NULL,
        speaking_confidence INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`),
      getD1().prepare(
        "CREATE INDEX IF NOT EXISTS assessment_results_user_email_created_at_idx ON assessment_results (user_email, created_at)",
      ),
    ])
    .then(() => undefined);
  return schemaReady;
}

export async function getLatestAssessmentForEmail(email: string) {
  await ensureAssessmentSchema();
  return (
    await getDb()
      .select()
      .from(schema.assessmentResults)
      .where(eq(schema.assessmentResults.userEmail, email))
      .orderBy(desc(schema.assessmentResults.createdAt))
      .limit(1)
  )[0] ?? null;
}
