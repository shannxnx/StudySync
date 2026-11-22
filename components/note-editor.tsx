"use client";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { api, message } from "./request";
import type { Note } from "@/lib/study";
export function NoteEditor({
  note,
  content,
}: {
  note: Note;
  content: JSONContent;
}) {
  const [title, setTitle] = useState(note.title),
    [status, setStatus] = useState("Saved");
  const latest = useRef({ title: note.title, content }),
    revision = useRef(note.revision),
    version = useRef(0),
    saved = useRef(0),
    busy = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  async function flush() {
    if (busy.current || version.current === saved.current) return;
    busy.current = true;
    try {
      while (saved.current < version.current) {
        const current = version.current;
        if (!latest.current.title.trim())
          throw new Error("Enter a title to save.");
        const result = await api<{ revision: number }>("save-note", {
          id: note.id,
          revision: revision.current,
          ...latest.current,
        });
        revision.current = result.revision;
        saved.current = current;
      }
      setStatus("Saved");
    } catch (err) {
      setStatus("Failed to save · " + message(err));
    } finally {
      busy.current = false;
    }
  }
  function schedule() {
    version.current++;
    setStatus("Saving…");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 650);
  }
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, protocols: ["https", "http"] },
      }),
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-editor",
        "aria-label": "Note content",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => {
      latest.current.content = editor.getJSON();
      schedule();
    },
  });
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (version.current !== saved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      clearTimeout(timer.current);
      void flushRef.current();
    };
  }, []);
  return (
    <article className="panel notebook">
      <div className="row between">
        <span>Notebook</span>
        <span role="status">{status}</span>
      </div>
      <label className="sr-only" htmlFor="note-title">
        Note title
      </label>
      <input
        id="note-title"
        className="note-title"
        value={title}
        maxLength={160}
        onChange={(e) => {
          setTitle(e.target.value);
          latest.current.title = e.target.value;
          schedule();
        }}
      />
      {editor && (
        <div className="toolbar">
          {(
            [
              [
                "Heading",
                () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
              ],
              ["Bold", () => editor.chain().focus().toggleBold().run()],
              ["Italic", () => editor.chain().focus().toggleItalic().run()],
              [
                "Underline",
                () => editor.chain().focus().toggleUnderline().run(),
              ],
              [
                "Bullets",
                () => editor.chain().focus().toggleBulletList().run(),
              ],
              [
                "Numbered",
                () => editor.chain().focus().toggleOrderedList().run(),
              ],
              ["Quote", () => editor.chain().focus().toggleBlockquote().run()],
              ["Code", () => editor.chain().focus().toggleCodeBlock().run()],
              [
                "Link",
                () => {
                  const href = window.prompt(
                    "Link URL (https:// or http://)",
                    String(editor.getAttributes("link").href ?? "https://"),
                  );
                  if (!href) return;
                  if (!/^https?:\/\//i.test(href)) {
                    setStatus(
                      "Enter a web URL starting with https:// or http://.",
                    );
                    return;
                  }
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .setLink({ href })
                    .run();
                },
              ],
              ["Undo", () => editor.chain().focus().undo().run()],
              ["Redo", () => editor.chain().focus().redo().run()],
            ] as [string, () => unknown][]
          ).map(([label, act]) => (
            <button key={label} type="button" onClick={act}>
              {label}
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
      {status.startsWith("Failed") && (
        <button className="btn outline" onClick={flush}>
          Retry save
        </button>
      )}
    </article>
  );
}
