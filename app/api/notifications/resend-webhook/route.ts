import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { recordEmailProviderEvent } from "../../../../db/notifications";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
function decodeBase64(value: string) {
  const binary = atob(value.replace(/^whsec_/, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function verifySignature(rawBody: string, webhookId: string, timestamp: string, signatureHeader: string) {
  if (!env.RESEND_WEBHOOK_SECRET || !webhookId || !timestamp || !signatureHeader) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  try {
    const key = await crypto.subtle.importKey("raw", decodeBase64(env.RESEND_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const payload = encoder.encode(`${webhookId}.${timestamp}.${rawBody}`);
    for (const item of signatureHeader.split(" ")) {
      const encoded = item.startsWith("v1,") ? item.slice(3) : item;
      if (!encoded) continue;
      if (await crypto.subtle.verify("HMAC", key, decodeBase64(encoded), payload)) return true;
    }
  } catch { return false; }
  return false;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const webhookId = request.headers.get("svix-id") || "";
  const timestamp = request.headers.get("svix-timestamp") || "";
  const signature = request.headers.get("svix-signature") || "";
  if (!await verifySignature(rawBody, webhookId, timestamp, signature)) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  const event = JSON.parse(rawBody) as { type?: string; created_at?: string; data?: { email_id?: string; id?: string } };
  const providerMessageId = event.data?.email_id || event.data?.id;
  if (!event.type || !providerMessageId) return NextResponse.json({ error: "Unsupported webhook payload" }, { status: 400 });
  const result = await recordEmailProviderEvent({ webhookId, providerMessageId, eventType: event.type, occurredAt: event.created_at || new Date().toISOString(), payload: rawBody });
  return NextResponse.json({ received: true, ...result });
}
