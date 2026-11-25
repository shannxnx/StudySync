import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  checkDb,
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
  type ItemKind,
  type ItemRecord,
  type LibraryStreams,
} from "./study";
import { notFound } from "next/navigation";
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
const columns = {
  subjects:
    "id,name,code,description,color,icon,deleting,created_at,updated_at",
  materials:
    "id,subject_id,filename,mime_type,size_bytes,status,processing_error,created_at,updated_at",
  notes: "id,subject_id,title,revision,created_at,updated_at",
  reviewers: "id,subject_id,title,format,saved,coverage,created_at,updated_at",
  quizzes:
    "id,subject_id,title,difficulty,question_types,coverage,created_at,updated_at",
  quiz_attempts: "id,subject_id,quiz_id,score,total,created_at",
};

export function streamLibrary(
  db: DB,
  user: { id: string; email?: string },
): LibraryStreams {
  function list<T>(table: keyof typeof columns, order = "updated_at") {
    return allRows<T>((a, b) =>
      db
        .from(table)
        .select(columns[table])
        .eq("user_id", user.id)
        .order(order, { ascending: false })
        .order("id")
        .range(a, b),
    );
  }
  async function profile(): Promise<Profile> {
    const { data, error } = await db
      .from("profiles")
      .select("id,full_name,created_at,avatar_url")
      .eq("id", user.id)
      .single();
    checkDb(error);
    return { ...data!, email: user.email ?? "" } as Profile;
  }
  return {
    subjects: list<Subject>("subjects"),
    materials: list<Material>("materials"),
    notes: list<Note>("notes"),
    reviewers: list<Reviewer>("reviewers"),
    quizzes: list<Quiz>("quizzes"),
    attempts: list<Attempt>("quiz_attempts", "created_at"),
    profile: profile(),
  };
}

export async function loadItem(
  db: DB,
  owner: string,
  kind: ItemKind,
  id: string,
  attempt?: string,
) {
  // Fetch content and its revision together so an editor never saves against stale metadata.
  const select =
    columns[kind] +
    (kind === "notes" || kind === "reviewers" ? ",content" : "");
  const itemQuery = db
    .from(kind)
    .select(select)
    .eq("user_id", owner)
    .eq("id", id)
    .maybeSingle();
  const [item, sources, questions, answers, score] = await Promise.all([
    itemQuery,
    kind === "reviewers"
      ? db
          .from("reviewer_sources")
          .select("material_id,note_id")
          .eq("user_id", owner)
          .eq("reviewer_id", id)
      : null,
    kind === "quizzes"
      ? db
          .from("quiz_questions")
          .select("id,question,kind,options,reference,position")
          .eq("user_id", owner)
          .eq("quiz_id", id)
          .order("position")
      : null,
    attempt
      ? db
          .from("quiz_attempt_answers")
          .select("question_id,chosen,correct,explanation")
          .eq("user_id", owner)
          .eq("quiz_id", id)
          .eq("attempt_id", attempt)
      : null,
    attempt
      ? db
          .from("quiz_attempts")
          .select(columns.quiz_attempts)
          .eq("user_id", owner)
          .eq("quiz_id", id)
          .eq("id", attempt)
          .maybeSingle()
      : null,
  ]);
  for (const result of [item, sources, questions, answers, score])
    if (result) checkDb(result.error);
  if (!item.data || (attempt && (!score?.data || !answers?.data?.length)))
    notFound();

  const { content, ...metadata } = item.data as unknown as Record<
    string,
    unknown
  >;
  const record = { kind, row: metadata } as ItemRecord;
  const detail: Detail = {};
  if (kind === "notes") detail.content = content as JSONContent;
  if (kind === "reviewers") {
    detail.sections = content as Section[];
    detail.materialIds = sources!.data!.flatMap((row) =>
      row.material_id ? [row.material_id] : [],
    );
    detail.noteIds = sources!.data!.flatMap((row) =>
      row.note_id ? [row.note_id] : [],
    );
  }
  if (kind === "materials" && metadata.mime_type !== "application/pdf") {
    detail.chunks = await allRows<Chunk>((a, b) =>
      db
        .from("material_chunks")
        .select("reference,body,position")
        .eq("user_id", owner)
        .eq("material_id", id)
        .order("position")
        .range(a, b),
    );
  }
  if (questions) detail.questions = questions.data as Question[];
  if (answers) detail.answers = answers.data as Answer[];
  return { record, detail, attemptRow: score?.data as Attempt | undefined };
}
