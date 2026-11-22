"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  X,
  UploadCloud,
  Files,
  FileText,
  NotebookPen,
  ListChecks,
  Layers,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, message } from "./request";
import {
  formats,
  levels,
  SUBJECT_ICONS,
  type Library,
  type Subject,
  type Generation,
} from "@/lib/study";
export type DialogSpec = {
  type: "subject" | "note" | "upload" | "reviewer" | "quiz";
  subject?: string;
  edit?: Subject;
  materialIds?: string[];
  noteIds?: string[];
  format?: string;
};
export function Modal({
  title,
  onClose,
  children,
  studyTool,
  busy = false,
}: {
  studyTool?: "quiz" | "reviewer";
  busy?: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={studyTool ? "modal generator-dialog" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="row between">
        <div className="row">
          {studyTool && (
            <span className="tool-icon" aria-hidden="true">
              {studyTool === "quiz" ? (
                <ListChecks size={22} />
              ) : (
                <Layers size={22} />
              )}
            </span>
          )}
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          className="icon-btn"
          disabled={busy}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function WorkspaceForm({
  spec,
  library,
  onClose,
}: {
  spec: DialogSpec;
  library: Library;
  onClose: () => void;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(
    spec.subject ?? library.subjects.find((s) => !s.deleting)?.id ?? "",
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [progress, setProgress] = useState("");
  const [sources, setSources] = useState<string[]>([
    ...(spec.materialIds ?? []),
    ...(spec.noteIds ?? []),
  ]);
  const [types, setTypes] = useState<Generation["types"]>([
    "choice",
    "boolean",
  ]);
  const [drag, setDrag] = useState(false);
  const locked = useRef(false);
  const [sourceTouched, setSourceTouched] = useState(
    Boolean(spec.materialIds || spec.noteIds),
  );
  const materials = library.materials.filter(
    (m) => m.subject_id === subject && m.status === "completed",
  );
  const notes = library.notes.filter((n) => n.subject_id === subject);
  const all = [
    ...materials.map((m) => ({ id: m.id, label: m.filename, kind: "File" })),
    ...notes.map((n) => ({ id: n.id, label: n.title, kind: "Note" })),
  ];
  const selected = all
    .filter((s) => !sourceTouched || sources.includes(s.id))
    .map((s) => s.id);
  const edit = spec.edit;
  const ai = spec.type === "reviewer" || spec.type === "quiz";
  const title =
    spec.type === "subject"
      ? edit
        ? "Edit subject"
        : "New subject"
      : spec.type === "note"
        ? "New note"
        : spec.type === "upload"
          ? "Upload materials"
          : spec.type === "quiz"
            ? "Create practice quiz"
            : "Generate reviewer";
  function upload(file: File, index: number, total: number) {
    return new Promise<{ status: string; message?: string }>(
      (resolve, reject) => {
        const xhr = new XMLHttpRequest(),
          form = new FormData();
        form.set("file", file);
        form.set("subject", subject);
        xhr.open("POST", "/api/materials/upload");
        xhr.timeout = 180000;
        xhr.upload.onprogress = (e) =>
          setProgress(
            file.name +
              " · " +
              (e.lengthComputable
                ? Math.round((100 * e.loaded) / e.total) + "%"
                : "uploading") +
              " (" +
              index +
              "/" +
              total +
              ")",
          );
        xhr.upload.onload = () =>
          setProgress("Extracting text from " + file.name + "…");
        xhr.onerror = xhr.ontimeout = () =>
          reject(
            new Error(
              "Upload interrupted. Check your materials before retrying.",
            ),
          );
        xhr.onload = () => {
          let data;
          try {
            data = JSON.parse(xhr.responseText);
          } catch {
            reject(new Error("Upload could not be processed."));
            return;
          }
          if (xhr.status < 300) resolve(data);
          else reject(new Error(data.error ?? "Upload failed."));
        };
        xhr.send(form);
      },
    );
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const val = (k: string) => String(f.get(k) ?? "");
    try {
      if (spec.type === "subject") {
        const row = await api<{ id: string }>("subject", {
          id: edit?.id,
          name: val("name"),
          code: val("code"),
          description: val("description"),
          color: val("color"),
          icon: val("icon"),
        });
        router.push("/dashboard/subjects/" + row.id);
      } else if (spec.type === "note") {
        const row = await api<{ id: string }>("new-note", {
          subject,
          title: val("title"),
        });
        router.push("/dashboard/notes/" + row.id);
      } else if (spec.type === "upload") {
        if (!files.length) throw new Error("Select at least one file.");
        const failures: string[] = [];
        const retry: File[] = [];
        for (const [i, file] of files.entries()) {
          try {
            const result = await upload(file, i + 1, files.length);
            if (result.status === "failed")
              failures.push(file.name + " · " + result.message);
          } catch (err) {
            retry.push(file);
            failures.push(file.name + " · " + message(err));
          }
        }
        setFiles(retry);
        router.refresh();
        if (failures.length) throw new Error(failures.join("\n"));
        toast.success("Materials uploaded");
      } else {
        const request: Generation = {
          id: crypto.randomUUID(),
          subject,
          kind: spec.type,
          materials: materials
            .filter((m) => selected.includes(m.id))
            .map((m) => m.id),
          notes: notes.filter((n) => selected.includes(n.id)).map((n) => n.id),
          format: (val("format") || formats[0]) as Generation["format"],
          difficulty: (val("difficulty") ||
            "Medium") as Generation["difficulty"],
          count: (Number(val("count")) || 5) as Generation["count"],
          types: spec.type === "quiz" ? types : ["choice"],
        };
        if (!selected.length) throw new Error("Choose at least one source.");
        if (!request.types.length)
          throw new Error("Choose at least one question type.");
        setProgress("Generating from your selected sources…");
        const row = await api<{ id: string }>("generate", request);
        router.push(
          "/dashboard/" +
            (spec.type === "quiz" ? "quizzes" : "reviewers") +
            "/" +
            row.id,
        );
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(message(err));
    } finally {
      locked.current = false;
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <Modal
      title={title}
      studyTool={
        spec.type === "quiz" || spec.type === "reviewer" ? spec.type : undefined
      }
      busy={busy}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {spec.type === "subject" ? (
            <>
              <label>
                Subject name
                <input
                  name="name"
                  maxLength={100}
                  required
                  defaultValue={edit?.name}
                />
              </label>
              <div className="form-grid">
                <label>
                  Subject code
                  <input name="code" maxLength={30} defaultValue={edit?.code} />
                </label>
                <label>
                  Color
                  <select name="color" defaultValue={edit?.color ?? "indigo"}>
                    {["indigo", "sage", "amber", "rose", "sky"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Icon
                <select name="icon" defaultValue={edit?.icon ?? "book"}>
                  {Object.entries(SUBJECT_ICONS).map(([id, t]) => (
                    <option value={id} key={id}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  maxLength={1200}
                  defaultValue={edit?.description}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Subject
                <select
                  aria-label="Subject"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setSourceTouched(false);
                  }}
                  required
                >
                  <option value="" disabled>
                    Choose a subject
                  </option>
                  {library.subjects
                    .filter((s) => !s.deleting)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              {spec.type === "note" && (
                <label>
                  Note title
                  <input name="title" maxLength={160} required />
                </label>
              )}
              {spec.type === "upload" && (
                <>
                  <label
                    className={"dropzone " + (drag ? "over" : "")}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDrag(true);
                    }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDrag(false);
                      setFiles((v) => [
                        ...v,
                        ...Array.from(e.dataTransfer.files),
                      ]);
                    }}
                  >
                    <UploadCloud />
                    <strong>Drop files or browse</strong>
                    <small>PDF, DOCX, and PPTX</small>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.pptx,.docx"
                      onChange={(e) =>
                        setFiles((v) => [
                          ...v,
                          ...Array.from(e.target.files ?? []),
                        ])
                      }
                    />
                  </label>
                  {files.map((f, i) => (
                    <div className="row between" key={i}>
                      <span>{f.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFiles((v) => v.filter((_, j) => j !== i))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </>
              )}
              {ai && (
                <>
                  <section
                    className="generator-group"
                    aria-labelledby="sources-heading"
                  >
                    <div className="group-heading">
                      <h3 id="sources-heading">Study sources</h3>
                      {all.length > 0 && (
                        <button
                          type="button"
                          className="text-btn"
                          onClick={() => {
                            setSources(
                              selected.length === all.length
                                ? []
                                : all.map((s) => s.id),
                            );
                            setSourceTouched(true);
                          }}
                        >
                          {selected.length === all.length
                            ? "Clear selection"
                            : "Select all"}
                        </button>
                      )}
                    </div>
                    {all.length > 0 ? (
                      <>
                        <div
                          className="source-list"
                          role="group"
                          aria-labelledby="sources-heading"
                        >
                          {all.map((s) => (
                            <label className="source-option" key={s.id}>
                              <input
                                type="checkbox"
                                checked={selected.includes(s.id)}
                                onChange={(e) => {
                                  setSources(
                                    e.target.checked
                                      ? [...selected, s.id]
                                      : selected.filter((id) => id !== s.id),
                                  );
                                  setSourceTouched(true);
                                }}
                              />
                              {s.kind === "File" ? (
                                <FileText aria-hidden size={16} />
                              ) : (
                                <NotebookPen aria-hidden size={16} />
                              )}
                              <span>{s.label}</span>
                              <small>{s.kind}</small>
                            </label>
                          ))}
                        </div>
                        <small role="status">
                          {selected.length
                            ? selected.length +
                              " of " +
                              all.length +
                              " selected"
                            : "Select at least one source to continue."}
                        </small>
                      </>
                    ) : (
                      <p className="source-empty">
                        <Files size={20} aria-hidden />
                        {subject
                          ? "Add a note or upload a material to this subject first."
                          : "Create a subject and add a note or material to get started."}
                      </p>
                    )}
                  </section>
                  {spec.type === "reviewer" ? (
                    <fieldset className="generator-group">
                      <legend>Reviewer format</legend>
                      <div className="format-options">
                        {formats.map((format) => (
                          <label className="format-option" key={format}>
                            <input
                              type="radio"
                              name="format"
                              value={format}
                              defaultChecked={
                                format === (spec.format ?? formats[0])
                              }
                            />
                            <span>
                              <strong>{format}</strong>
                              <small>
                                {
                                  {
                                    "Quick summary":
                                      "A short overview and takeaways.",
                                    "Detailed reviewer":
                                      "Topic explanations, key takeaways, and self-checks with answers.",
                                    "Key concepts":
                                      "Important terms and their meanings.",
                                  }[format]
                                }
                              </small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : (
                    <section
                      className="generator-group"
                      aria-labelledby="quiz-settings"
                    >
                      <h3 id="quiz-settings">Quiz settings</h3>
                      <div className="form-grid">
                        <label>
                          Questions
                          <select name="count">
                            {[5, 10, 20].map((n) => (
                              <option key={n}>{n}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Difficulty
                          <select name="difficulty" defaultValue="Medium">
                            {levels.map((level) => (
                              <option key={level}>{level}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <fieldset>
                        <legend>Question types</legend>
                        <div className="type-options">
                          {(["choice", "boolean"] as const).map((type) => (
                            <label key={type} className="type-option">
                              <input
                                type="checkbox"
                                checked={types.includes(type)}
                                onChange={(e) =>
                                  setTypes(
                                    e.target.checked
                                      ? [...types, type]
                                      : types.filter((t) => t !== type),
                                  )
                                }
                              />
                              {type === "choice"
                                ? "Multiple choice"
                                : "True/false"}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      {!types.length && (
                        <small role="status">
                          Choose at least one question type.
                        </small>
                      )}
                    </section>
                  )}
                </>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {progress && (
            <p role="status" className="notice">
              {progress}
            </p>
          )}
          <Button
            disabled={
              busy ||
              (!subject && spec.type !== "subject") ||
              (ai && !selected.length) ||
              (spec.type === "quiz" && !types.length)
            }
          >
            {busy
              ? ai
                ? "Generating…"
                : "Working…"
              : edit
                ? "Save changes"
                : title}
            {ai &&
              (busy ? (
                <LoaderCircle className="study-spinner" size={16} aria-hidden />
              ) : (
                <ArrowRight size={16} aria-hidden />
              ))}
          </Button>
        </fieldset>
      </form>
    </Modal>
  );
}
