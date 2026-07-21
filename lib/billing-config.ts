export const BILLING_CURRENCY = "kzt";

export const BILLING_PLANS = {
  starter_week: {
    id: "starter_week", kind: "one_time", tier: "starter", label: "7-Day Starter Pass",
    durationLabel: "7 days", amount: 1_000_000, accessDays: 7,
    description: "One week of complete platform access with no teacher meetings.",
  },
  silver_month: {
    id: "silver_month", kind: "subscription", tier: "silver", label: "Silver · 1 month",
    durationLabel: "1 month", amount: 4_000_000, interval: "month", intervalCount: 1,
    description: "Self-study platform access for one month.",
  },
  silver_3_months: {
    id: "silver_3_months", kind: "subscription", tier: "silver", label: "Silver · 3 months",
    durationLabel: "3 months", amount: 11_000_000, interval: "month", intervalCount: 3,
    description: "Three months of self-study access with ₸10,000 built-in savings.",
  },
  silver_6_months: {
    id: "silver_6_months", kind: "subscription", tier: "silver", label: "Silver · 6 months",
    durationLabel: "6 months", amount: 20_000_000, interval: "month", intervalCount: 6,
    description: "Six months of self-study access with ₸40,000 built-in savings.",
  },
  gold_month: {
    id: "gold_month", kind: "subscription", tier: "gold", label: "Gold · 1 month",
    durationLabel: "1 month", amount: 6_000_000, interval: "month", intervalCount: 1,
    description: "Guided learning with two small-group teacher sessions every week.",
  },
  gold_3_months: {
    id: "gold_3_months", kind: "subscription", tier: "gold", label: "Gold · 3 months",
    durationLabel: "3 months", amount: 15_000_000, interval: "month", intervalCount: 3,
    description: "Three months of guided learning with ₸30,000 built-in savings.",
  },
  gold_6_months: {
    id: "gold_6_months", kind: "subscription", tier: "gold", label: "Gold · 6 months",
    durationLabel: "6 months", amount: 27_000_000, interval: "month", intervalCount: 6,
    description: "Six months of guided learning with ₸90,000 built-in savings.",
  },
  platinum_month: {
    id: "platinum_month", kind: "subscription", tier: "platinum", label: "Platinum · 1 month",
    durationLabel: "1 month", amount: 9_000_000, interval: "month", intervalCount: 1,
    description: "Personal coaching with three individual teacher sessions every week.",
  },
  platinum_3_months: {
    id: "platinum_3_months", kind: "subscription", tier: "platinum", label: "Platinum · 3 months",
    durationLabel: "3 months", amount: 24_000_000, interval: "month", intervalCount: 3,
    description: "Three months of personal coaching with ₸30,000 built-in savings.",
  },
  platinum_6_months: {
    id: "platinum_6_months", kind: "subscription", tier: "platinum", label: "Platinum · 6 months",
    durationLabel: "6 months", amount: 42_000_000, interval: "month", intervalCount: 6,
    description: "Six months of personal coaching with ₸120,000 built-in savings.",
  },
} as const;

export type BillingPlanId = keyof typeof BILLING_PLANS;
export type BillingTier = "silver" | "gold" | "platinum";

export const BILLING_PACKAGES: Array<{
  tier: BillingTier;
  name: string;
  subtitle: string;
  meetingLabel: string;
  badge: string | null;
  planIds: BillingPlanId[];
  features: string[];
}> = [
  {
    tier: "silver", name: "Silver", subtitle: "Self-Study", meetingLabel: "Platform only · no teacher meetings", badge: null,
    planIds: ["silver_month", "silver_3_months", "silver_6_months"],
    features: ["All four IELTS modules", "Speaking and Writing AI feedback", "Adaptive study plan", "Weekend mock comparisons"],
  },
  {
    tier: "gold", name: "Gold", subtitle: "Guided Learning", meetingLabel: "2 small-group teacher sessions every week", badge: "MOST POPULAR",
    planIds: ["gold_month", "gold_3_months", "gold_6_months"],
    features: ["Everything in Silver", "Two live sessions each week", "Teacher-led group practice", "Accountability and progress guidance"],
  },
  {
    tier: "platinum", name: "Platinum", subtitle: "Personal Coaching", meetingLabel: "3 individual teacher sessions every week", badge: "HIGHEST SUPPORT",
    planIds: ["platinum_month", "platinum_3_months", "platinum_6_months"],
    features: ["Everything in Gold", "Three private sessions each week", "Individual teacher feedback", "Personal preparation strategy"],
  },
];

export const CAPY_DISCOUNT_TIERS = [
  { coins: 500, percent: 5 },
  { coins: 1_000, percent: 10 },
  { coins: 1_500, percent: 15 },
] as const;

export function isBillingPlanId(value: unknown): value is BillingPlanId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(BILLING_PLANS, value);
}

export function discountForCoins(coins: number) {
  return [...CAPY_DISCOUNT_TIERS].reverse().find((tier) => coins >= tier.coins)?.percent ?? 0;
}

export function discountedAmount(amount: number, percent: number) {
  return Math.max(0, Math.round(amount * (100 - percent) / 100));
}

export function billingTierRank(planId: string) {
  if (!(planId in BILLING_PLANS)) return -1;
  const tier = BILLING_PLANS[planId as BillingPlanId].tier;
  return tier === "starter" ? 0 : tier === "silver" ? 1 : tier === "gold" ? 2 : 3;
}

export function isMembershipUpgrade(currentPlanId: string, nextPlanId: BillingPlanId) {
  return BILLING_PLANS[nextPlanId].kind === "subscription" && billingTierRank(nextPlanId) > billingTierRank(currentPlanId);
}

export function billingPlanLabel(planId: string) {
  if (planId in BILLING_PLANS) return BILLING_PLANS[planId as BillingPlanId].label;
  if (planId === "monthly") return "Monthly";
  if (planId === "annual") return "Annual";
  if (planId === "one_month") return "Gold · 1 month";
  if (planId === "three_months") return "Gold · 3 months";
  if (planId === "six_months") return "Gold · 6 months";
  return "Membership";
}

export function formatCurrency(amount: number, currency = BILLING_CURRENCY) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: currency.toUpperCase(),
    maximumFractionDigits: currency.toLowerCase() === "kzt" ? 0 : 2,
  }).format(amount / 100);
}
