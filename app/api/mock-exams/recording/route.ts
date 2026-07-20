import { NextResponse } from "next/server";
import { getApiLearningUser } from "../../../learning-access";
import { getApiCreatorUser } from "../../../creator-auth";
import { getMockRecording } from "../../../../db/mock-engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const attemptId = Number(url.searchParams.get("attemptId"));
  const itemKey = url.searchParams.get("itemKey") ?? "";
  if (!Number.isInteger(attemptId) || !itemKey) return NextResponse.json({ error: "Invalid recording." }, { status: 400 });
  const creator = await getApiCreatorUser("mocks");
  if (creator.user) {
    const recording = await getMockRecording(creator.user.email, attemptId, itemKey, true);
    if (!recording) return NextResponse.json({ error: "Recording not found." }, { status: 404 });
    return new Response(recording.object.body, { headers: { "Content-Type": recording.contentType, "Content-Disposition": `inline; filename="${recording.fileName.replace(/[\r\n\"]/g, "")}"`, "Cache-Control": "private, no-store" } });
  }
  const access = await getApiLearningUser();
  if (!access.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const recording = await getMockRecording(access.user.email, attemptId, itemKey, false);
  if (!recording) return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  return new Response(recording.object.body, { headers: { "Content-Type": recording.contentType, "Content-Disposition": `inline; filename="${recording.fileName.replace(/[\r\n\"]/g, "")}"`, "Cache-Control": "private, no-store" } });
}
