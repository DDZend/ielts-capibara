import type { Metadata } from "next";
import { getBillingSummary } from "../../db";
import { stripeCheckoutConfigured } from "../../lib/stripe-server";
import { requireChatGPTUser } from "../chatgpt-auth";
import { paywallEnabled } from "../learning-access";
import { BillingClient } from "./BillingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Membership & billing | IELTS Mastery",
  description: "Manage your IELTS Mastery subscription, sponsored access and payment history.",
};

type BillingPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const user = await requireChatGPTUser("/billing");
  const params = await searchParams;
  const summary = await getBillingSummary(user.email);
  return <BillingClient
    userName={user.displayName}
    summary={summary}
    checkoutConfigured={stripeCheckoutConfigured()}
    paywallActive={paywallEnabled()}
    accessRequired={params.access === "required"}
    checkoutResult={params.checkout === "success" ? "success" : params.checkout === "cancelled" ? "cancelled" : null}
  />;
}
