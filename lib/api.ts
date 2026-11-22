import "server-only";
import { z } from "zod";
import { createClient } from "./supabase/server";
import { StudyError } from "./study";
export async function session(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    let caller: URL;
    try {
      caller = new URL(origin);
    } catch {
      throw new StudyError("Invalid request origin.", 403);
    }
    const sameHost =
      ["http:", "https:"].includes(caller.protocol) &&
      caller.host === request.headers.get("host");
    if (
      !sameHost &&
      origin !== new URL(request.url).origin &&
      origin !== process.env.SITE_URL
    )
      throw new StudyError("Request origin is unavailable.", 403);
  }
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new StudyError("Sign in to continue.", 401);
  return { db, uid: data.user.id };
}
export async function bodyBytes(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new StudyError("Upload exceeds the size limit.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new StudyError("Request is empty.");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > max) {
        await reader.cancel();
        throw new StudyError("Request exceeds the size limit.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export function failure(error: unknown) {
  const status =
    error instanceof StudyError
      ? error.status
      : error instanceof z.ZodError || error instanceof SyntaxError
        ? 400
        : 500;
  const message =
    error instanceof StudyError
      ? error.message
      : error instanceof z.ZodError
        ? error.issues[0]?.message
        : "The request could not be completed. Please try again.";
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
