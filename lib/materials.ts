import "server-only";
import { z } from "zod";
import { type DB, allRows } from "./library";
import {
  extractDocument,
  fileKind,
  maxBytes,
  mime,
  validateOffice,
} from "./documents";
import { checkDb, StudyError } from "./study";
export const bucket = "study-materials";
export async function uploadMaterial(
  db: DB,
  uid: string,
  subject: string,
  file: File,
) {
  z.uuid().parse(subject);
  const { error: subjectError } = await db
    .from("subjects")
    .select("id")
    .eq("id", subject)
    .eq("user_id", uid)
    .eq("deleting", false)
    .single();
  checkDb(subjectError);
  if (file.size > maxBytes())
    throw new StudyError("File exceeds the configured upload limit.", 413);
  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = fileKind(file.name, file.size, file.type, buffer);
  try {
    await validateOffice(buffer, kind);
  } catch (e) {
    throw e instanceof StudyError
      ? e
      : new StudyError(
          "This Office file is damaged or has an unsupported format.",
        );
  }
  const id = crypto.randomUUID();
  const path = [uid, subject, id].join("/");
  checkDb(
    (
      await db.from("materials").insert({
        id,
        user_id: uid,
        subject_id: subject,
        filename: file.name,
        mime_type: mime[kind],
        size_bytes: file.size,
      })
    ).error,
  );
  const { error } = await db.storage
    .from(bucket)
    .upload(path, buffer, { contentType: mime[kind], upsert: false });
  if (error) {
    await db.from("materials").delete().eq("id", id).eq("user_id", uid);
    throw new StudyError(
      "File storage rejected the upload. Please retry.",
      503,
    );
  }
  checkDb(
    (
      await db
        .from("materials")
        .update({ status: "processing" })
        .eq("id", id)
        .eq("user_id", uid)
    ).error,
  );
  try {
    const chunks = await extractDocument(buffer, kind);
    for (let i = 0; i < chunks.length; i += 100) {
      checkDb(
        (
          await db.from("material_chunks").insert(
            chunks.slice(i, i + 100).map((c) => ({
              ...c,
              user_id: uid,
              subject_id: subject,
              material_id: id,
            })),
          )
        ).error,
      );
    }
    checkDb(
      (
        await db
          .from("materials")
          .update({ status: "completed" })
          .eq("id", id)
          .eq("user_id", uid)
      ).error,
    );
    return { id, status: "completed" };
  } catch (e) {
    const message =
      e instanceof StudyError
        ? e.message
        : "Text extraction failed. The original file is available to download.";
    checkDb(
      (
        await db
          .from("materials")
          .update({ status: "failed", processing_error: message })
          .eq("id", id)
          .eq("user_id", uid)
      ).error,
    );
    return { id, status: "failed", message };
  }
}
export async function removeMaterial(db: DB, uid: string, id: string) {
  const row = await db
    .from("materials")
    .update({ deleting: true })
    .eq("id", id)
    .eq("user_id", uid)
    .select("storage_path")
    .single();
  checkDb(row.error);
  if ((await db.storage.from(bucket).remove([row.data!.storage_path])).error)
    throw new StudyError(
      "Unable to remove the file from storage. Please retry.",
      503,
    );
  checkDb(
    (await db.from("materials").delete().eq("id", id).eq("user_id", uid)).error,
  );
}
export async function removeSubject(db: DB, uid: string, id: string) {
  checkDb(
    (
      await db
        .from("subjects")
        .update({ deleting: true })
        .eq("id", id)
        .eq("user_id", uid)
        .select("id")
        .single()
    ).error,
  );
  const files = await allRows<{ storage_path: string }>((a, b) =>
    db
      .from("materials")
      .select("storage_path")
      .eq("subject_id", id)
      .eq("user_id", uid)
      .order("id")
      .range(a, b),
  );
  for (let n = 0; n < files.length; n += 100) {
    if (
      (
        await db.storage
          .from(bucket)
          .remove(files.slice(n, n + 100).map((f) => f.storage_path))
      ).error
    )
      throw new StudyError(
        "Deletion paused during file cleanup. Retry deleting the subject.",
        503,
      );
  }
  checkDb(
    (await db.from("subjects").delete().eq("id", id).eq("user_id", uid)).error,
  );
}
