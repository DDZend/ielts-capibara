import type { Metadata } from "next";
import { getSponsoredPassByCode } from "../../db";
import { requireChatGPTUser } from "../chatgpt-auth";
import { SponsoredAccessClient } from "./SponsoredAccessClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Claim sponsored access | IELTS Mastery" };

type SponsoredAccessPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SponsoredAccessPage({ searchParams }: SponsoredAccessPageProps) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code.toUpperCase() : "";
  const user = await requireChatGPTUser(`/sponsored-access${code ? `?code=${encodeURIComponent(code)}` : ""}`);
  const pass = /^[A-Z0-9]{12}$/.test(code) ? await getSponsoredPassByCode(code) : null;
  return <SponsoredAccessClient userName={user.displayName} code={code} pass={pass} />;
}
