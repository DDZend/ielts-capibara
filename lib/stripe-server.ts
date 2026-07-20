import { env } from "cloudflare:workers";
import Stripe from "stripe";

function secret(name: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET") {
  const values = env as unknown as Record<string, string | undefined>;
  return values[name]?.trim() || null;
}

export function getStripe() {
  const key = secret("STRIPE_SECRET_KEY");
  return key ? new Stripe(key) : null;
}

export function getStripeWebhookSecret() {
  return secret("STRIPE_WEBHOOK_SECRET");
}

export function stripeCheckoutConfigured() {
  return Boolean(secret("STRIPE_SECRET_KEY") && secret("STRIPE_WEBHOOK_SECRET"));
}
