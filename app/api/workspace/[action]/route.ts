import { z } from "zod";
import { session, failure, bodyBytes } from "@/lib/api";
import { subjectInput, generatorInput, checkDb, StudyError } from "@/lib/study";
import { cleanNote } from "@/lib/notes";
import { removeSubject, removeMaterial, bucket } from "@/lib/materials";
import { generateTool } from "@/lib/generate-tool";
const uuid = z.uuid(),
  title = z.string().trim().min(1).max(160);
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/workspace/[action]">,
) {
  try {
    const { action } = await ctx.params;
    const { db, uid } = await session(request);
    const body = JSON.parse(
      (await bodyBytes(request, 1500000)).toString("utf8"),
    );
    let result: unknown = { ok: true };
    switch (action) {
      case "subject": {
        const fields = subjectInput.parse(body);
        const query = body.id
          ? db
              .from("subjects")
              .update(fields)
              .eq("id", uuid.parse(body.id))
              .eq("user_id", uid)
          : db.from("subjects").insert({ ...fields, user_id: uid });
        const saved = await query.select("id").single();
        checkDb(saved.error);
        result = saved.data;
        break;
      }
      case "new-note": {
        const row = await db
          .from("notes")
          .insert({
            user_id: uid,
            subject_id: uuid.parse(body.subject),
            title: title.parse(body.title),
          })
          .select("id")
          .single();
        checkDb(row.error);
        result = row.data;
        break;
      }
      case "save-note": {
        const rev = z.number().int().nonnegative().parse(body.revision);
        const row = await db
          .from("notes")
          .update({
            ...cleanNote(body.content),
            title: title.parse(body.title),
            revision: rev + 1,
          })
          .eq("user_id", uid)
          .eq("id", uuid.parse(body.id))
          .eq("revision", rev)
          .select("revision")
          .maybeSingle();
        checkDb(row.error);
        if (!row.data)
          throw new StudyError(
            "Another tab changed this note. Copy your edits, then reload.",
            409,
          );
        result = row.data;
        break;
      }
      case "reviewer": {
        const fields = z
          .object({
            title: title.optional(),
            saved: z.literal(true).optional(),
          })
          .parse(body);
        checkDb(
          (
            await db
              .from("reviewers")
              .update(fields)
              .eq("id", uuid.parse(body.id))
              .eq("user_id", uid)
              .select("id")
              .single()
          ).error,
        );
        break;
      }
      case "file-url": {
        const meta = await db
          .from("materials")
          .select("storage_path,filename")
          .eq("id", uuid.parse(body.id))
          .eq("user_id", uid)
          .single();
        checkDb(meta.error);
        const file = await db.storage
          .from(bucket)
          .createSignedUrl(
            meta.data!.storage_path,
            600,
            body.download === true ? { download: meta.data!.filename } : {},
          );
        if (file.error)
          throw new StudyError("Unable to open the stored file.", 503);
        result = { url: file.data.signedUrl };
        break;
      }
      case "delete": {
        const id = uuid.parse(body.id),
          kind = z
            .enum(["subjects", "materials", "notes", "reviewers", "quizzes"])
            .parse(body.kind);
        if (kind === "subjects") await removeSubject(db, uid, id);
        else if (kind === "materials") await removeMaterial(db, uid, id);
        else
          checkDb(
            (
              await db
                .from(kind)
                .delete()
                .eq("id", id)
                .eq("user_id", uid)
                .select("id")
                .single()
            ).error,
          );
        break;
      }
      case "generate":
        result = await generateTool(db, uid, generatorInput.parse(body));
        break;
      case "submit": {
        const answers = z
          .record(z.uuid(), z.number().int().min(0).max(3))
          .parse(body.answers);
        const attempt = uuid.parse(body.attempt),
          quiz = uuid.parse(body.quiz);
        const grade = await db.rpc("grade_quiz", {
          p_quiz: quiz,
          p_attempt: attempt,
          p_answers: answers,
        });
        if (grade.error?.code === "P0001")
          throw new StudyError("Quiz unavailable or answers incomplete.");
        checkDb(grade.error);
        result = { id: grade.data };
        break;
      }
      case "profile": {
        const name = z.string().trim().min(1).max(100).parse(body.name);
        checkDb(
          (
            await db
              .from("profiles")
              .update({ full_name: name })
              .eq("id", uid)
              .select("id")
              .single()
          ).error,
        );
        break;
      }
      default:
        throw new StudyError("Unknown workspace operation.", 404);
    }
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
