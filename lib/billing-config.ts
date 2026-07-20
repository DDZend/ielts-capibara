export const BILLING_CURRENCY = "kzt";

export const BILLING_PLANS = {
  one_month: {
    id: "one_month",
    label: "1 month",
    interval: "month",
    intervalCount: 1,
    amount: 6_000_000,
    description: "Full IELTS Mastery access for one focused month.",
  },
  three_months: {
    id: "three_months",
    label: "3 months",
    interval: "month",
    intervalCount: 3,
    amount: 15_000_000,
    description: "Three months of access with ₸30,000 built-in savings.",
  },
  six_months: {
    id: "six_months",
    label: "6 months",
    interval: "month",
    intervalCount: 6,
    amount: 27_000_000,
    description: "Six months of access with ₸90,000 built-in savings.",
  },
} as const;

export type BillingPlanId = keyof typeof BILLING_PLANS;

export const CAPI_DISCOUNT_TIERS = [
  { coins: 500, percent: 5 },
  { coins: 1_000, percent: 10 },
  { coins: 1_500, percent: 15 },
] as const;

export function isBillingPlanId(value: unknown): value is BillingPlanId {
  return value === "one_month" || value === "three_months" || value === "six_months";
}

export function discountForCoins(coins: number) {
  return [...CAPI_DISCOUNT_TIERS].reverse().find((tier) => coins >= tier.coins)?.percent ?? 0;
}

export function discountedAmount(amount: number, percent: number) {
  return Math.max(0, Math.round(amount * (100 - percent) / 100));
}

export function billingPlanLabel(planId: string) {
  if (planId in BILLING_PLANS) return BILLING_PLANS[planId as BillingPlanId].label;
  if (planId === "monthly") return "Monthly";
  if (planId === "annual") return "Annual";
  return "Membership";
}

export function formatCurrency(amount: number, currency = BILLING_CURRENCY) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: currency.toLowerCase() === "kzt" ? 0 : 2,
  }).format(amount / 100);
}
