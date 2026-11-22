import { z } from "zod";
import type { JSONContent } from "@tiptap/react";
export const subjectInput = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(30),
  description: z.string().trim().max(1200),
  color: z.enum(["indigo", "sage", "amber", "rose", "sky"]),
  icon: z.enum(["book", "science", "math", "language", "art"]),
});
export const formats = [
  "Detailed reviewer",
  "Quick summary",
  "Key concepts",
] as const;
export const levels = ["Easy", "Medium", "Hard"] as const;
export const generatorInput = z
  .object({
    id: z.uuid(),
    subject: z.uuid(),
    kind: z.enum(["reviewer", "quiz"]),
    materials: z.array(z.uuid()).max(40),
    notes: z.array(z.uuid()).max(40),
    format: z.enum(formats),
    difficulty: z.enum(levels),
    count: z.union([z.literal(5), z.literal(10), z.literal(20)]),
    types: z
      .array(z.enum(["choice", "boolean"]))
      .min(1)
      .max(2),
  })
  .refine(
    (v) => v.materials.length + v.notes.length > 0,
    "Select at least one source.",
  );
export type Generation = z.infer<typeof generatorInput>;
export type Subject = z.infer<typeof subjectInput> & {
  id: string;
  created_at: string;
  updated_at: string;
  deleting: boolean;
};
export type Row = {
  id: string;
  subject_id: string;
  created_at: string;
  updated_at: string;
};
export type Material = Row & {
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  processing_error: string | null;
};
export type Note = Row & { title: string; revision: number };
export type Reviewer = Row & {
  title: string;
  format: string;
  saved: boolean;
  coverage: string;
};
export type Quiz = Row & {
  title: string;
  difficulty: string;
  coverage: string;
  question_types: string[];
};
export type Attempt = {
  id: string;
  quiz_id: string;
  subject_id: string;
  score: number;
  total: number;
  created_at: string;
};
export type Question = {
  id: string;
  question: string;
  kind: string;
  options: string[];
  reference: string;
  position: number;
};
export type Answer = {
  question_id: string;
  chosen: number;
  correct: number;
  explanation: string;
};
export type Section = {
  heading: string;
  body: string;
  reference: string;
  keyPoints?: string[];
  selfCheck?: { question: string; answer: string };
};
export type Chunk = { reference: string; body: string; position: number };
export type Profile = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  avatar_url: string | null;
};
export type Library = {
  subjects: Subject[];
  materials: Material[];
  notes: Note[];
  reviewers: Reviewer[];
  quizzes: Quiz[];
  attempts: Attempt[];
  profile: Profile;
};
export type Detail = {
  content?: JSONContent;
  sections?: Section[];
  chunks?: Chunk[];
  questions?: Question[];
  answers?: Answer[];
  materialIds?: string[];
  noteIds?: string[];
};
export class StudyError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export function checkDb(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === "PGRST116")
    throw new StudyError("This item is unavailable.", 404);
  if (error.code === "23503" || error.code === "23505")
    throw new StudyError("The workspace changed. Refresh and try again.", 409);
  throw new StudyError(
    "The database could not complete this request. Please retry.",
    503,
  );
}
export const SUBJECT_ICONS = {
  book: "Book",
  science: "Science",
  math: "Math",
  language: "Language",
  art: "Art",
};
