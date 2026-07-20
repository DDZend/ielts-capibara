export const BILLING_CURRENCY = "usd";

export const BILLING_PLANS = {
  monthly: { id: "monthly", label: "Monthly", interval: "month", amount: 1_900, description: "Flexible access, billed every month." },
  annual: { id: "annual", label: "Annual", interval: "year", amount: 14_900, description: "A full year of IELTS preparation at the best base price." },
} as const;

export type BillingPlanId = keyof typeof BILLING_PLANS;

export const CAPI_DISCOUNT_TIERS = [
  { coins: 500, percent: 5 },
  { coins: 1_000, percent: 10 },
  { coins: 1_500, percent: 15 },
] as const;

export function isBillingPlanId(value: unknown): value is BillingPlanId {
  return value === "monthly" || value === "annual";
}

export function discountForCoins(coins: number) {
  return [...CAPI_DISCOUNT_TIERS].reverse().find((tier) => coins >= tier.coins)?.percent ?? 0;
}

export function discountedAmount(amount: number, percent: number) {
  return Math.max(0, Math.round(amount * (100 - percent) / 100));
}

export function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount / 100);
}
