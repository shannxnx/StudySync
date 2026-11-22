import type { JSONContent } from "@tiptap/react";
import { StudyError } from "./study";
const blocks = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
]);
const marks = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
]);
export function cleanNote(value: unknown): {
  content: JSONContent;
  plain_text: string;
} {
  let count = 0;
  function visit(raw: unknown, depth: number): JSONContent {
    if (!raw || typeof raw !== "object" || depth > 32 || ++count > 30000)
      throw new StudyError("This note is too complex.");
    const n = raw as JSONContent;
    if (!n.type || !blocks.has(n.type))
      throw new StudyError("Unsupported note formatting.");
    const out: JSONContent = { type: n.type };
    if (n.type === "text") {
      if (typeof n.text !== "string" || !n.text.length)
        throw new StudyError("Invalid note text.");
      out.text = n.text;
      out.marks = (n.marks ?? [])
        .filter((m) => marks.has(m.type))
        .flatMap((m) => {
          if (m.type !== "link") return [{ type: m.type }];
          const href = String(m.attrs?.href ?? "");
          return /^https?:\/\//i.test(href)
            ? [
                {
                  type: "link",
                  attrs: { href, rel: "noopener noreferrer", target: "_blank" },
                },
              ]
            : [];
        });
    } else if (n.content)
      out.content = n.content.map((child) => visit(child, depth + 1));
    if (n.type === "heading")
      out.attrs = {
        level: [1, 2, 3].includes(n.attrs?.level) ? n.attrs?.level : 2,
      };
    return out;
  }
  const content = visit(value, 0);
  if (content.type !== "doc") throw new StudyError("Invalid note document.");
  function plain(n: JSONContent): string {
    if (n.type === "text") return n.text ?? "";
    if (n.type === "hardBreak") return "\n";
    return (
      (n.content ?? []).map(plain).join("") +
      (["paragraph", "heading", "codeBlock"].includes(n.type ?? "") ? "\n" : "")
    );
  }
  const plain_text = plain(content).trim();
  if (plain_text.length > 250000)
    throw new StudyError("Notes support up to 250,000 characters.");
  return { content, plain_text };
}
