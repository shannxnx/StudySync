"use client";
import Link from "./workspace-link";
import "./study-tools.css";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  { ssr: false, loading: () => <WorkspaceSkeleton area="notes" detail /> },
);
const PdfViewer = dynamic(
  () => import("./pdf-viewer").then((m) => m.PdfViewer),
  { ssr: false, loading: () => <WorkspaceSkeleton area="materials" detail /> },
);
import { QuizView } from "./quiz";
import type {
  Attempt,
  Library,
  Detail,
  ItemKind,
  ItemRecord,
} from "@/lib/study";
import { useLibrary } from "./workspace-library";
import { WorkspaceSkeleton } from "./workspace-skeleton";
const primary: Record<Category, [DialogSpec["type"], string]> = {
  subjects: ["subject", "New subject"],
  materials: ["upload", "Upload materials"],
  notes: ["note", "New note"],
  reviewers: ["reviewer", "Generate reviewer"],
  quizzes: ["quiz", "Create quiz"],
};
type Area = keyof typeof names;
type Props = {
  area: Area;
  id?: string;
  attempt?: string;
  attemptRow?: Attempt;
  detail?: Detail;
  record?: ItemRecord;
};

export function DetailPreview({ area, id }: { area: ItemKind; id: string }) {
  const library = useLibrary([area]);
  const row = library[area].find((item) => item.id === id);
  const title =
    row &&
    ("name" in row ? row.name : "filename" in row ? row.filename : row.title);
  return <WorkspaceSkeleton area={area} detail title={title} />;
}

function FormWithLibrary({
  dialog,
  close,
}: {
  dialog: DialogSpec;
  close: () => void;
}) {
  return <WorkspaceForm spec={dialog} library={useLibrary()} onClose={close} />;
}

function SubjectContent({
  id,
  quick,
  create,
}: {
  id: string;
  quick: (subjectId: string) => React.ReactNode;
  create: (kind: Category, subjectId: string) => React.ReactNode;
}) {
  const query = useSearchParams();
  const tab = query.get("tab") ?? "overview";
  const collection = ["materials", "notes", "reviewers", "quizzes"].includes(
    tab,
  )
    ? (tab as ItemKind)
    : undefined;
  return (
    <>
      <nav className="tabs" aria-label="Subject sections">
        {["overview", "materials", "notes", "reviewers", "quizzes"].map(
          (name) => {
            const href = "/dashboard/subjects/" + id + "?tab=" + name;
            return (
              <a
                key={name}
                href={href}
                aria-current={
                  (collection ?? "overview") === name ? "page" : undefined
                }
                onClick={(event) => {
                  if (
                    event.button ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  if (tab !== name) window.history.pushState(null, "", href);
                }}
              >
                {name}
              </a>
            );
          },
        )}
      </nav>
      <Suspense
        fallback={<WorkspaceSkeleton area={collection ?? "dashboard"} />}
      >
        {collection ? (
          <>
            {create(collection, id)}
            <SubjectCollection key={collection} kind={collection} id={id} />
          </>
        ) : (
          <>
            {quick(id)}
            <WorkspaceActivity subject={id} />
          </>
        )}
      </Suspense>
    </>
  );
}

function SubjectCollection({ kind, id }: { kind: ItemKind; id: string }) {
  return (
    <Collection
      kind={kind}
      subject={id}
      library={useLibrary(["subjects", kind])}
    />
  );
}
function WorkspaceActivity({ subject }: { subject?: string }) {
  return <Activity library={useLibrary()} subject={subject} />;
}
function DashboardSubjects() {
  const library = useLibrary(["subjects", "materials", "notes"]);
  return (
    <SubjectCards subjects={library.subjects.slice(0, 6)} library={library} />
  );
}
function DashboardStats() {
  const l = useLibrary(["subjects", "materials", "notes", "attempts"]);
  return (
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
  );
}

export function Workspace({
  area: section,
  id,
  attempt,
  attemptRow,
  detail = {},
  record,
}: Props) {
  const parts: Exclude<keyof Library, "profile">[] =
    section === "settings" ? [] : ["subjects"];
  if (section === "subjects" && !id) parts.push("materials", "notes");
  if (!id && section !== "dashboard" && section !== "settings")
    parts.push(section);
  if (section === "quizzes" && id) parts.push("attempts");
  const l = useLibrary(parts);
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const [pending, setPending] = useState(false);
  const subject = record?.kind === "subjects" ? record.row : undefined;
  const material = record?.kind === "materials" ? record.row : undefined;
  const note = record?.kind === "notes" ? record.row : undefined;
  const review = record?.kind === "reviewers" ? record.row : undefined;
  const quiz = record?.kind === "quizzes" ? record.row : undefined;
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
    <div className="workspace-page" data-section={section}>
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
          <Suspense
            fallback={
              <div
                className="stats"
                role="status"
                aria-label="Loading statistics"
              >
                {[0, 1, 2, 3].map((i) => (
                  <div className="skeleton-stat" key={i} />
                ))}
              </div>
            }
          >
            <DashboardStats />
          </Suspense>
          <section>
            <div className="row between">
              <h2>My subjects</h2>
              <Link className="inline-link" href="/dashboard/subjects">
                View all <ArrowRight size={15} />
              </Link>
            </div>
            {l.subjects.length ? (
              <Suspense fallback={<WorkspaceSkeleton area="subjects" />}>
                <DashboardSubjects />
              </Suspense>
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
          <Suspense fallback={<WorkspaceSkeleton area="notes" />}>
            <WorkspaceActivity />
          </Suspense>
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
              <SubjectContent id={id} create={create} quick={quick} />
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
              attempt={attemptRow}
              answers={detail.answers}
            />
          )}
        </>
      )}
      {dialog && (
        <Suspense fallback={<WorkspaceSkeleton area={section} />}>
          <FormWithLibrary dialog={dialog} close={() => setDialog(null)} />
        </Suspense>
      )}
    </div>
  );
}
