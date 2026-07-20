import { getChatGPTUser } from "../../../chatgpt-auth";
import { isCreatorEmail } from "../../../creator-auth";
import { learningAccessAllowed } from "../../../learning-access";
import { getMediaAssetForDelivery, getMediaBucket } from "../../../../db/creator";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response("Not found.", { status: 404 });
  const asset = await getMediaAssetForDelivery(id);
  if (!asset) return new Response("Not found.", { status: 404 });
  const creator = isCreatorEmail(user.email);
  if (!creator && asset.lesson_status !== "published") return new Response("Not found.", { status: 404 });
  if (!creator && !await learningAccessAllowed(user.email)) return new Response("Learning access required.", { status: 402 });
  const object = await getMediaBucket().get(asset.r2_key);
  if (!object) return new Response("Media unavailable.", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": asset.content_type || object.httpMetadata?.contentType || "application/octet-stream",
      "Content-Length": String(object.size),
      ETag: object.httpEtag || object.etag,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
