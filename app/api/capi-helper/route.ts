import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureAppSchema, getD1 } from "../../../db";

export const dynamic = "force-dynamic";

const GIFT_COST = 500;
const ACCESS_HOURS = 24;

export async function POST() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  await ensureAppSchema();
  const createdAt = new Date().toISOString();
  const insert = await getD1().prepare(`
    INSERT INTO capi_helper_gifts (donor_email, coins, access_hours, status, created_at)
    SELECT ?, ?, ?, 'available', ?
    WHERE (
      (SELECT COUNT(*) * 40 FROM study_tasks WHERE user_email = ? AND completed_at IS NOT NULL)
      - COALESCE((SELECT SUM(coins) FROM capi_helper_gifts WHERE donor_email = ?), 0)
    ) >= ?
  `).bind(
    user.email,
    GIFT_COST,
    ACCESS_HOURS,
    createdAt,
    user.email,
    user.email,
    GIFT_COST,
  ).run();

  if (!insert.meta.changes) {
    return NextResponse.json({ error: "You need 500 available Capi-Coins to sponsor a learner." }, { status: 409 });
  }

  const totals = await getD1().prepare(`
    SELECT
      ((SELECT COUNT(*) * 40 FROM study_tasks WHERE user_email = ? AND completed_at IS NOT NULL)
      - COALESCE((SELECT SUM(coins) FROM capi_helper_gifts WHERE donor_email = ?), 0)) AS balance,
      (SELECT COUNT(*) FROM capi_helper_gifts WHERE donor_email = ?) AS sponsored_passes
  `).bind(user.email, user.email, user.email).first<{ balance: number; sponsored_passes: number }>();

  return NextResponse.json({
    gift: { coins: GIFT_COST, accessHours: ACCESS_HOURS, status: "available", createdAt },
    balance: Math.max(0, Number(totals?.balance ?? 0)),
    sponsoredPasses: Number(totals?.sponsored_passes ?? 1),
  }, { status: 201 });
}
