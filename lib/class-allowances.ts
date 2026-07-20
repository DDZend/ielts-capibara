import { BILLING_PLANS } from "./billing-config";

export type ClassAllowance = {
  tier: "none" | "silver" | "gold" | "platinum";
  weeklyLimit: number;
  sessionType: "none" | "group" | "individual";
  label: string;
};

export function classAllowanceForPlan(planId: string | null): ClassAllowance {
  const plan = planId && planId in BILLING_PLANS ? BILLING_PLANS[planId as keyof typeof BILLING_PLANS] : null;
  const tier = plan?.tier;
  if (tier === "gold") return { tier, weeklyLimit: 2, sessionType: "group", label: "2 group teacher meetings each week" };
  if (tier === "platinum") return { tier, weeklyLimit: 3, sessionType: "individual", label: "3 individual teacher meetings each week" };
  if (tier === "silver") return { tier, weeklyLimit: 0, sessionType: "none", label: "Platform-only membership" };
  return { tier: "none", weeklyLimit: 0, sessionType: "none", label: "No teacher-meeting allowance" };
}

export function utcWeekWindow(value = new Date()) {
  const day = value.getUTCDay() || 7;
  const start = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() - day + 1));
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}
