import { NextResponse } from "next/server";
import { getApiCreatorUser } from "../../../creator-auth";
import { COURSE_CATALOG, isCourseModule } from "../../../../lib/course-catalog";
import { attachMedia, ensureCreatorCatalog, getMediaBucket } from "../../../../db/creator";

export const dynamic = "force-dynamic";

const allowedTypes = {
  video: new Set(["video/mp4", "video/webm", "video/quicktime"]),
  audio: new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm"]),
};

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-100) || "media";
}

export async function POST(request: Request) {
  const auth = await getApiCreatorUser();
  if (!auth.user) return NextResponse.json({ error: auth.status === 401 ? "Sign in required." : "Teacher access required." }, { status: auth.status });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }
  const file = form.get("file");
  const courseModule = form.get("module");
  const lessonId = form.get("lessonId");
  const kind = form.get("kind");
  if (!(file instanceof File) || !isCourseModule(courseModule) || typeof lessonId !== "string" || (kind !== "video" && kind !== "audio")) {
    return NextResponse.json({ error: "Choose a valid lesson and media file." }, { status: 400 });
  }
  if (!COURSE_CATALOG.some((lesson) => lesson.module === courseModule && lesson.id === lessonId)) {
    return NextResponse.json({ error: "That lesson is not in the course catalog." }, { status: 404 });
  }
  if (!allowedTypes[kind].has(file.type)) {
    return NextResponse.json({ error: kind === "video" ? "Upload an MP4, WebM, or MOV video." : "Upload an MP3, M4A, WAV, OGG, or WebM audio file." }, { status: 415 });
  }
  const maxBytes = kind === "video" ? 100 * 1024 * 1024 : 25 * 1024 * 1024;
  if (!file.size || file.size > maxBytes) {
    return NextResponse.json({ error: `${kind === "video" ? "Video" : "Audio"} must be smaller than ${kind === "video" ? "100 MB" : "25 MB"}.` }, { status: 413 });
  }
  await ensureCreatorCatalog(auth.user.email);
  const key = `creator/${courseModule.toLowerCase()}/${lessonId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const bucket = getMediaBucket();
  try {
    await bucket.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { owner: auth.user.email, module: courseModule, lessonId, kind },
    });
    const id = await attachMedia({
      module: courseModule,
      lessonId,
      kind,
      fileName: file.name.slice(0, 180),
      contentType: file.type,
      sizeBytes: file.size,
      r2Key: key,
      ownerEmail: auth.user.email,
    });
    return NextResponse.json({ id, url: `/api/media/${id}`, fileName: file.name });
  } catch (error) {
    await bucket.delete(key).catch(() => undefined);
    console.error("Creator media upload failed", error);
    return NextResponse.json({ error: "The upload could not be saved. Please try again." }, { status: 500 });
  }
}
