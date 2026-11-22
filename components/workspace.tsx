"use client";
import Link from "next/link";
import "./study-tools.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  NotebookPen,
  ListChecks,
  Plus,
  ArrowRight,
  Download,
  Copy,
  Check,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { api, message } from "./request";
import { Button } from "./ui/button";
import { WorkspaceForm, type DialogSpec } from "./forms";
import {
  Collection,
  Activity,
  Empty,
  SubjectCards,
  SubjectIcon,
  names,
  formatDate,
  type Category,
} from "./collections";
import { AccountSettings } from "./account-settings";
import dynamic from "next/dynamic";
const NoteEditor = dynamic(
  () => import("./note-editor").then((m) => m.NoteEditor),
  { ssr: false, loading: () => <p>Opening note…</p> },
);
const PdfViewer = dynamic(
  () => import("./pdf-viewer").then((m) => m.PdfViewer),
  { ssr: false, loading: () => <p>Opening PDF…</p> },
);
import { QuizView } from "./quiz";
import type { Library, Detail } from "@/lib/study";
const primary: Record<Category, [DialogSpec["type"], string]> = {
  subjects: ["subject", "New subject"],
  materials: ["upload", "Upload materials"],
  notes: ["note", "New note"],
  reviewers: ["reviewer", "Generate reviewer"],
  quizzes: ["quiz", "Create quiz"],
};
type Props = {
  library: Library;
  area: string;
  id?: string;
  attempt?: string;
  detail: Detail;
  tab: string;
};
export function Workspace({
  library: l,
  area,
  id,
  attempt,
  detail,
  tab,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const [pending, setPending] = useState(false);
  const section = area as keyof typeof names;
  const subject = l.subjects.find((x) => x.id === id),
    material = l.materials.find((x) => x.id === id),
    note = l.notes.find((x) => x.id === id),
    review = l.reviewers.find((x) => x.id === id),
    quiz = l.quizzes.find((x) => x.id === id);
  const title =
    subject?.name ??
    material?.filename ??
    note?.title ??
    review?.title ??
    quiz?.title ??
    names[section];
  const parent = l.subjects.find(
    (s) => s.id === (material ?? note ?? review ?? quiz)?.subject_id,
  );
  function open(spec: DialogSpec) {
    setDialog(
      spec.type !== "subject" && !l.subjects.some((s) => !s.deleting)
        ? { type: "subject" }
        : spec,
    );
  }
  async function task(fn: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    try {
      await fn();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setPending(false);
    }
  }
  function remove(kind: Category, rowId: string, label: string) {
    if (
      window.confirm(
        "Delete “" +
          label +
          "”? " +
          (kind === "subjects"
            ? "Its files, notes, reviewers, quizzes, and attempts will also be deleted."
            : "This cannot be undone."),
      )
    )
      void task(async () => {
        await api("delete", { kind, id: rowId });
        toast.success("Deleted");
        router.push("/dashboard/" + kind);
        router.refresh();
      });
  }
  function create(kind: Category, subjectId?: string) {
    const needsSubject =
      kind !== "subjects" && !l.subjects.some((s) => !s.deleting);
    const [type, label] = primary[needsSubject ? "subjects" : kind];
    return (
      <Button onClick={() => open({ type, subject: subjectId })}>
        <Plus size={16} />
        {label}
      </Button>
    );
  }
  function quick(subjectId?: string) {
    return (
      <div className="quick-actions">
        {(["materials", "notes", "reviewers", "quizzes"] as const).map((k) => (
          <button
            className="btn outline"
            key={k}
            onClick={() => open({ type: primary[k][0], subject: subjectId })}
          >
            {primary[k][1]}
          </button>
        ))}
      </div>
    );
  }
  return (
    <>
      {section === "dashboard" ? (
        <>
          <section className="welcome">
            <div>
              <h1>
                Welcome
                {l.profile.full_name
                  ? ", " + l.profile.full_name.split(" ")[0]
                  : " back"}
                .
              </h1>
              <p>Pick a subject and take your next study step.</p>
            </div>
            {l.subjects.length > 0 && create("subjects")}
          </section>
          <div className="stats">
            {(
              [
                [BookOpen, "Subjects", l.subjects.length, "subjects"],
                [FileText, "Materials", l.materials.length, "materials"],
                [NotebookPen, "Notes", l.notes.length, "notes"],
                [ListChecks, "Quizzes taken", l.attempts.length, "quizzes"],
              ] as const
            ).map(([Icon, label, n, k]) => (
              <Link href={"/dashboard/" + k} key={k}>
                <Icon size={19} />
                <small>{label}</small>
                <strong>{n}</strong>
              </Link>
            ))}
          </div>
          <section>
            <div className="row between">
              <h2>My subjects</h2>
              <Link className="inline-link" href="/dashboard/subjects">
                View all <ArrowRight size={15} />
              </Link>
            </div>
            {l.subjects.length ? (
              <SubjectCards subjects={l.subjects.slice(0, 6)} library={l} />
            ) : (
              <Empty title="Create your first subject">
                <p>
                  Keep each course’s materials, notes, and practice in one
                  place.
                </p>
                {create("subjects")}
              </Empty>
            )}
          </section>
          {l.subjects.length > 0 && (
            <section>
              <h2>Quick actions</h2>
              {quick()}
            </section>
          )}
          <Activity library={l} />
        </>
      ) : section === "settings" ? (
        <AccountSettings profile={l.profile} />
      ) : !id ? (
        <>
          <div className="row between">
            <h1>{names[section]}</h1>
            {create(section as Category)}
          </div>
          <Collection library={l} kind={section as Category} />
        </>
      ) : (
        <>
          {parent && (
            <Link
              className="inline-link"
              href={"/dashboard/subjects/" + parent.id}
            >
              {parent.name} <ChevronRight size={13} />
            </Link>
          )}
          <div className="detail-head">
            <div>
              {subject && <SubjectIcon subject={subject} />}
              <h1>{title}</h1>
            </div>
            <div className="row">
              {subject && (
                <button
                  className="btn outline"
                  onClick={() => open({ type: "subject", edit: subject })}
                >
                  Edit subject
                </button>
              )}
              <button
                className="btn ghost"
                disabled={pending}
                onClick={() => remove(section as Category, id, title)}
              >
                Delete
              </button>
            </div>
          </div>
          {subject && (
            <>
              {subject.code && <small>{subject.code}</small>}
              {subject.description && <p>{subject.description}</p>}
              <nav className="tabs" aria-label="Subject sections">
                {["overview", "materials", "notes", "reviewers", "quizzes"].map(
                  (t) => (
                    <Link
                      key={t}
                      aria-current={t === tab ? "page" : undefined}
                      href={"/dashboard/subjects/" + id + "?tab=" + t}
                    >
                      {t}
                    </Link>
                  ),
                )}
              </nav>
              {["materials", "notes", "reviewers", "quizzes"].includes(tab) ? (
                <>
                  {create(tab as Category, id)}
                  <Collection
                    key={tab}
                    kind={tab as Category}
                    library={l}
                    subject={id}
                  />
                </>
              ) : (
                <>
                  {quick(id)}
                  <Activity library={l} subject={id} />
                </>
              )}
            </>
          )}
          {material && (
            <>
              <div className="row between">
                <p>
                  {(material.size_bytes / 1024).toFixed(0)} KB ·{" "}
                  {material.status} · {formatDate(material.created_at)}
                </p>
                <Button
                  disabled={pending}
                  onClick={() =>
                    void task(async () => {
                      const r = await api<{ url: string }>("file-url", {
                        id,
                        download: true,
                      });
                      window.location.assign(r.url);
                    })
                  }
                >
                  <Download size={16} />
                  Download
                </Button>
              </div>
              {material.processing_error && (
                <p className="notice">{material.processing_error}</p>
              )}
              {material.mime_type === "application/pdf" ? (
                <PdfViewer id={id} />
              ) : (
                <section className="panel">
                  <h2>Extracted text</h2>
                  {detail.chunks?.length ? (
                    detail.chunks.map((c) => (
                      <div className="excerpt" key={c.position}>
                        <small>{c.reference}</small>
                        <p>{c.body}</p>
                      </div>
                    ))
                  ) : (
                    <p>
                      No text preview available. Download the original file
                      above.
                    </p>
                  )}
                </section>
              )}
            </>
          )}
          {note && detail.content && (
            <NoteEditor key={id} note={note} content={detail.content} />
          )}
          {review && (
            <>
              <div className="study-meta">
                <span>{review.format}</span>
                <span>{review.saved ? "Saved reviewer" : "Draft preview"}</span>
                <small>{review.coverage}</small>
              </div>
              <div className="quick-actions">
                {!review.saved && (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      void task(async () => {
                        await api("reviewer", { id, saved: true });
                        router.refresh();
                        toast.success("Reviewer saved");
                      })
                    }
                  >
                    <Check size={16} />
                    Save reviewer
                  </Button>
                )}
                <button
                  className="btn outline"
                  onClick={() => {
                    const title = window.prompt("Reviewer title", review.title);
                    if (title?.trim())
                      void task(async () => {
                        await api("reviewer", { id, title });
                        router.refresh();
                      });
                  }}
                >
                  Rename
                </button>
                <button
                  className="btn outline"
                  onClick={() =>
                    open({
                      type: "reviewer",
                      subject: review.subject_id,
                      format: "Detailed reviewer",
                      materialIds: detail.materialIds,
                      noteIds: detail.noteIds,
                    })
                  }
                >
                  {review.format === "Detailed reviewer"
                    ? "Regenerate"
                    : "Expand reviewer"}
                </button>
                <button
                  className="btn outline"
                  onClick={() =>
                    void task(async () => {
                      await navigator.clipboard.writeText(
                        review.title +
                          "\n\n" +
                          detail.sections
                            ?.map((s) =>
                              [
                                s.heading,
                                s.body,
                                ...(s.keyPoints?.map((point) => "• " + point) ??
                                  []),
                                ...(s.selfCheck
                                  ? [s.selfCheck.question, s.selfCheck.answer]
                                  : []),
                                s.reference,
                              ].join("\n"),
                            )
                            .join("\n\n"),
                      );
                      toast.success("Reviewer copied");
                    })
                  }
                >
                  <Copy size={15} />
                  Copy
                </button>
              </div>
              <div
                className={
                  detail.sections && detail.sections.length > 1
                    ? "review-layout has-contents"
                    : "review-layout"
                }
              >
                {detail.sections && detail.sections.length > 1 && (
                  <nav
                    className="panel review-contents"
                    aria-label="Reviewer contents"
                  >
                    <h3>In this reviewer</h3>
                    <ol>
                      {detail.sections.map((section, i) => (
                        <li key={i}>
                          <a href={"#review-section-" + (i + 1)}>
                            {section.heading}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                )}
                <div className="panel review-paper">
                  {detail.sections?.map((section, i) => (
                    <article
                      className="excerpt"
                      id={"review-section-" + (i + 1)}
                      key={i}
                      tabIndex={-1}
                    >
                      <h2>{section.heading}</h2>
                      <p>{section.body}</p>
                      {section.keyPoints && section.keyPoints.length > 0 && (
                        <div className="review-takeaways">
                          <h3>Key takeaways</h3>
                          <ul>
                            {section.keyPoints.map((point, j) => (
                              <li key={j}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {section.selfCheck && (
                        <div className="review-recall">
                          <h3>Check your understanding</h3>
                          <p>{section.selfCheck.question}</p>
                          <details>
                            <summary>Show answer</summary>
                            <p>{section.selfCheck.answer}</p>
                          </details>
                        </div>
                      )}
                      <small className="source-citation">
                        <BookOpen size={15} aria-hidden />
                        {section.reference}
                      </small>
                    </article>
                  ))}
                </div>
              </div>
            </>
          )}
          {quiz && (
            <QuizView
              key={quiz.id + (attempt ?? "practice")}
              quiz={quiz}
              questions={detail.questions ?? []}
              history={l.attempts.filter((a) => a.quiz_id === id)}
              attempt={l.attempts.find((a) => a.id === attempt)}
              answers={detail.answers}
            />
          )}
        </>
      )}
      {dialog && (
        <WorkspaceForm
          spec={dialog}
          library={l}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
