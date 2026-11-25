"use client";
import Link from "./workspace-link";
import { useMemo, useState } from "react";
import {
  BookOpen,
  FlaskConical,
  Calculator,
  Languages,
  Palette,
  FileText,
  NotebookPen,
  ListChecks,
  Layers,
  ArrowUpRight,
  FolderOpen,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import type { Library, Subject } from "@/lib/study";
export type Category =
  "subjects" | "materials" | "notes" | "reviewers" | "quizzes";
export const names = {
  dashboard: "Dashboard",
  subjects: "My subjects",
  materials: "All materials",
  notes: "My notes",
  reviewers: "Reviewers",
  quizzes: "Practice quizzes",
  settings: "Settings",
};
export const icons = {
  subjects: BookOpen,
  materials: FileText,
  notes: NotebookPen,
  reviewers: Layers,
  quizzes: ListChecks,
};
export const formatDate = (value: string) =>
  format(new Date(value), "MMM d, yyyy");
export function SubjectIcon({ subject }: { subject: Subject }) {
  const Icon =
    {
      book: BookOpen,
      science: FlaskConical,
      math: Calculator,
      language: Languages,
      art: Palette,
    }[subject.icon] ?? BookOpen;
  return (
    <span className={"subject-icon " + subject.color}>
      <Icon size={20} />
    </span>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <FolderOpen size={29} strokeWidth={1.4} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function SubjectCards({
  subjects,
  library,
}: {
  subjects: Subject[];
  library: Library;
}) {
  const counts = useMemo(() => {
    const countsFor = (rows: { subject_id: string }[]) => {
      const result = new Map<string, number>();
      for (const row of rows)
        result.set(row.subject_id, (result.get(row.subject_id) ?? 0) + 1);
      return result;
    };
    return {
      materials: countsFor(library.materials),
      notes: countsFor(library.notes),
    };
  }, [library.materials, library.notes]);
  return (
    <div className="cards">
      {subjects.map((s) => (
        <Link
          key={s.id}
          className="subject-card"
          href={"/dashboard/subjects/" + s.id}
        >
          <div className="row between">
            <SubjectIcon subject={s} />
            <ArrowUpRight size={16} />
          </div>
          <small>{s.code}</small>
          <h3>{s.name}</h3>
          {s.description && <p>{s.description}</p>}
          <footer>
            {counts.materials.get(s.id) ?? 0} materials ·{" "}
            {counts.notes.get(s.id) ?? 0} notes
            <br />
            Updated {formatDate(s.updated_at)}
          </footer>
        </Link>
      ))}
    </div>
  );
}
export function entries(library: Library, kind: Category, subject?: string) {
  if (kind === "subjects")
    return library.subjects.map((s) => ({
      id: s.id,
      title: s.name,
      date: s.updated_at,
      description: s.code + " " + s.description,
    }));
  const subjects = new Map(library.subjects.map((row) => [row.id, row.name]));
  return library[kind]
    .filter((row) => !subject || row.subject_id === subject)
    .map((row) => ({
      id: row.id,
      title: "filename" in row ? row.filename : row.title,
      date: row.updated_at,
      description: [
        subjects.get(row.subject_id),
        "status" in row
          ? row.status
          : "format" in row
            ? row.format + (row.saved ? "" : " · Draft")
            : "difficulty" in row
              ? row.difficulty
              : "Note",
      ]
        .filter(Boolean)
        .join(" · "),
    }));
}
export function Collection({
  library,
  kind,
  subject,
}: {
  library: Library;
  kind: Category;
  subject?: string;
}) {
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("recent");
  const Icon = icons[kind];
  const subjectById = useMemo(
    () => new Map(library.subjects.map((s) => [s.id, s])),
    [library.subjects],
  );
  const index = useMemo(
    () => entries(library, kind, subject),
    [library, kind, subject],
  );
  const rows = index
    .filter((r) =>
      (r.title + " " + r.description)
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : sort === "old"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date),
    );
  return (
    <>
      <div className="filters">
        <label className="search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              "Search " + names[kind].replace(/^(My |All )/, "").toLowerCase()
            }
            aria-label="Filter items"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort items"
        >
          <option value="recent">Recently updated</option>
          <option value="old">Oldest first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      {!rows.length ? (
        <Empty title={query ? "No matching items" : "No " + kind + " yet"}>
          <p>
            {query
              ? "Try a different search."
              : kind === "subjects"
                ? "Create a subject for your first course."
                : "Use the action above to add your first item."}
          </p>
        </Empty>
      ) : kind === "subjects" ? (
        <SubjectCards
          subjects={rows.map((r) => subjectById.get(r.id)!)}
          library={library}
        />
      ) : (
        <div className="panel listing">
          {rows.map((r) => (
            <Link
              className="list-row"
              key={r.id}
              href={"/dashboard/" + kind + "/" + r.id}
            >
              <span className="file-icon">
                <Icon size={19} />
              </span>
              <span className="grow">
                <strong>{r.title}</strong>
                <small>{r.description}</small>
              </span>
              <small>{formatDate(r.date)}</small>
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
export function Activity({
  library,
  subject,
}: {
  library: Library;
  subject?: string;
}) {
  const items = (["materials", "notes", "reviewers"] as const).flatMap((kind) =>
    entries(library, kind, subject).map((r) => ({
      ...r,
      kind,
      href: "/dashboard/" + kind + "/" + r.id,
    })),
  );
  const quizzes = new Map(library.quizzes.map((quiz) => [quiz.id, quiz.title]));
  const attempts = library.attempts
    .filter((a) => !subject || a.subject_id === subject)
    .map((a) => ({
      id: a.id,
      kind: "quizzes" as const,
      title: quizzes.get(a.quiz_id) ?? "Quiz",
      description: "Quiz completed · " + a.score + "/" + a.total,
      date: a.created_at,
      href: "/dashboard/quizzes/" + a.quiz_id + "/results/" + a.id,
    }));
  const latest = [...items, ...attempts]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  return (
    <section>
      <h2>Recent activity</h2>
      {latest.length ? (
        <div className="panel listing">
          {latest.map((r) => {
            const Icon = icons[r.kind];
            return (
              <Link href={r.href} className="list-row" key={r.id}>
                <Icon size={18} />
                <div className="grow">
                  <strong>{r.title}</strong>
                  <small>{r.description}</small>
                </div>
                <small>{formatDate(r.date)}</small>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty title="Your activity will appear here">
          <p>Upload a material or write a note to get started.</p>
        </Empty>
      )}
    </section>
  );
}
