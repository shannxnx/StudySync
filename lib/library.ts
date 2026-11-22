import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  checkDb,
  type Library,
  type Detail,
  type Material,
  type Subject,
  type Note,
  type Reviewer,
  type Quiz,
  type Attempt,
  type Profile,
  type Question,
  type Answer,
  type Chunk,
  type Section,
  StudyError,
} from "./study";
import type { JSONContent } from "@tiptap/react";
export type DB = Awaited<ReturnType<typeof createClient>>;
export async function allRows<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string; code?: string } | null;
  }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await query(from, from + 499);
    checkDb(error);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 500) return out;
  }
}
export async function loadLibrary(
  db: DB,
  user: { id: string; email?: string; created_at: string },
): Promise<Library> {
  function list<T>(table: string, select: string, order = "updated_at") {
    return allRows<T>((a, b) =>
      db
        .from(table)
        .select(select)
        .eq("user_id", user.id)
        .order(order, { ascending: false })
        .order("id")
        .range(a, b),
    );
  }
  const [subjects, materials, notes, reviewers, quizzes, attempts, profile] =
    await Promise.all([
      list<Subject>(
        "subjects",
        "id,name,code,description,color,icon,deleting,created_at,updated_at",
      ),
      list<Material>(
        "materials",
        "id,subject_id,filename,mime_type,size_bytes,status,processing_error,created_at,updated_at",
      ),
      list<Note>("notes", "id,subject_id,title,revision,created_at,updated_at"),
      list<Reviewer>(
        "reviewers",
        "id,subject_id,title,format,saved,coverage,created_at,updated_at",
      ),
      list<Quiz>(
        "quizzes",
        "id,subject_id,title,difficulty,question_types,coverage,created_at,updated_at",
      ),
      list<Attempt>(
        "quiz_attempts",
        "id,subject_id,quiz_id,score,total,created_at",
        "created_at",
      ),
      db
        .from("profiles")
        .select("id,full_name,created_at,avatar_url")
        .eq("id", user.id)
        .single(),
    ]);
  checkDb(profile.error);
  return {
    subjects,
    materials,
    notes,
    reviewers,
    quizzes,
    attempts,
    profile: { ...profile.data, email: user.email ?? "" } as Profile,
  };
}
export async function detailFor(
  db: DB,
  owner: string,
  kind: string,
  id: string,
  attempt?: string,
): Promise<Detail> {
  if (kind === "notes") {
    const { data, error } = await db
      .from("notes")
      .select("content")
      .eq("user_id", owner)
      .eq("id", id)
      .single();
    checkDb(error);
    return { content: data!.content as JSONContent };
  }
  if (kind === "reviewers") {
    const { data, error } = await db
      .from("reviewers")
      .select("content")
      .eq("user_id", owner)
      .eq("id", id)
      .single();
    checkDb(error);
    const items = await db
      .from("reviewer_sources")
      .select("material_id,note_id")
      .eq("reviewer_id", id)
      .eq("user_id", owner);
    checkDb(items.error);
    return {
      sections: data!.content as Section[],
      materialIds: items.data!.flatMap((v) =>
        v.material_id ? [v.material_id] : [],
      ),
      noteIds: items.data!.flatMap((v) => (v.note_id ? [v.note_id] : [])),
    };
  }
  if (kind === "materials")
    return {
      chunks: await allRows<Chunk>((a, b) =>
        db
          .from("material_chunks")
          .select("reference,body,position")
          .eq("user_id", owner)
          .eq("material_id", id)
          .order("position")
          .range(a, b),
      ),
    };
  if (kind === "quizzes") {
    const { data, error } = await db
      .from("quiz_questions")
      .select("id,question,kind,options,reference,position")
      .eq("user_id", owner)
      .eq("quiz_id", id)
      .order("position");
    checkDb(error);
    const result: Detail = { questions: data as Question[] };
    if (attempt) {
      const answers = await db
        .from("quiz_attempt_answers")
        .select("question_id,chosen,correct,explanation")
        .eq("user_id", owner)
        .eq("quiz_id", id)
        .eq("attempt_id", attempt);
      checkDb(answers.error);
      if (!answers.data?.length)
        throw new StudyError("Attempt unavailable.", 404);
      result.answers = answers.data as Answer[];
    }
    return result;
  }
  return {};
}
