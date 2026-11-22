import { execFile } from "node:child_process";
import { join, posix } from "node:path";
import { fromBufferPromise } from "yauzl";
import { XMLParser } from "fast-xml-parser";
import { StudyError, type Chunk } from "./study";
export const mime = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
export const maxBytes = () =>
  Math.min(20, Math.max(1, Number(process.env.MAX_UPLOAD_MB) || 20)) *
  1024 *
  1024;
export function fileKind(
  name: string,
  size: number,
  type: string,
  buffer: Buffer,
): keyof typeof mime {
  const ext = name.split(".").pop()?.toLowerCase() as keyof typeof mime;
  if (!Object.hasOwn(mime, ext) || !name.trim() || name.length > 255)
    throw new StudyError("Choose a PDF, DOCX, or PPTX file.");
  if (!size || size > maxBytes())
    throw new StudyError(
      "File size must be between one byte and " + maxBytes() / 1048576 + " MB.",
      413,
    );
  if (type && type !== "application/octet-stream" && type !== mime[ext])
    throw new StudyError(
      "The declared file type does not match its extension.",
    );
  if (
    ext === "pdf"
      ? buffer.subarray(0, 5).toString() !== "%PDF-"
      : !buffer.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))
  )
    throw new StudyError("The file contents do not match its extension.");
  return ext;
}
async function officeParts(buffer: Buffer, kind: "docx" | "pptx") {
  const zip = await fromBufferPromise(buffer, { lazyEntries: true });
  const parts = new Map<string, string>();
  let bytes = 0;
  try {
    if (zip.entryCount > 6000)
      throw new StudyError("This Office file has too many parts.");
    for await (const entry of zip.eachEntry()) {
      const name = entry.fileName;
      if (
        name !== "[Content_Types].xml" &&
        !(kind === "docx"
          ? name === "word/document.xml"
          : name === "ppt/presentation.xml" ||
            name === "ppt/_rels/presentation.xml.rels" ||
            /^ppt\/slides\/[^/]+\.xml$/.test(name))
      )
        continue;
      bytes += entry.uncompressedSize;
      if (bytes > 24 * 1024 * 1024 || entry.uncompressedSize > 12 * 1024 * 1024)
        throw new StudyError(
          "The expanded document text exceeds the processing limit.",
        );
      const stream = await zip.openReadStreamPromise(entry);
      const data: Buffer[] = [];
      let length = 0;
      for await (const block of stream) {
        length += block.length;
        if (length > entry.uncompressedSize)
          throw new StudyError("Invalid Office document.");
        data.push(block);
      }
      const xml = Buffer.concat(data).toString("utf8");
      if (/<!DOCTYPE|<!ENTITY/i.test(xml))
        throw new StudyError("Unsupported XML in document.");
      parts.set(name, xml);
    }
  } finally {
    zip.close();
  }
  const manifest = parts.get("[Content_Types].xml") ?? "";
  if (
    !manifest.includes(
      kind === "docx"
        ? "wordprocessingml.document.main+xml"
        : "presentationml.presentation.main+xml",
    )
  )
    throw new StudyError("The Office document type is incorrect.");
  parts.delete("[Content_Types].xml");
  if (!parts.size)
    throw new StudyError("The Office document has no readable document parts.");
  return parts;
}
function slidesInPresentationOrder(parts: Map<string, string>): string[] {
  const manifest = parts.get("ppt/presentation.xml");
  const relationships = parts.get("ppt/_rels/presentation.xml.rels");
  if (!manifest || !relationships)
    throw new StudyError("The slide order is missing from this presentation.");
  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name) => name === "p:sldId" || name === "Relationship",
  });
  const ids: { "@_r:id": string }[] =
    parser.parse(manifest)["p:presentation"]?.["p:sldIdLst"]?.["p:sldId"] ?? [];
  const links: {
    "@_Id": string;
    "@_Target": string;
    "@_TargetMode"?: string;
  }[] = parser.parse(relationships).Relationships?.Relationship ?? [];
  const targets = new Map(
    links
      .filter((r) => r["@_TargetMode"] !== "External")
      .map((r) => [r["@_Id"], r["@_Target"]]),
  );
  return ids.map((id) => {
    const target = targets.get(id["@_r:id"]);
    const part = target && parts.get(posix.resolve("/ppt", target).slice(1));
    if (!part)
      throw new StudyError(
        "A slide referenced by this presentation is missing.",
      );
    return part;
  });
}
type XmlNode = { [tag: string]: XmlNode[] | string };
function paragraphs(xml: string): string[] {
  const nodes = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: true,
    trimValues: false,
    parseTagValue: false,
  }).parse(xml) as XmlNode[];
  const out: string[] = [];
  function walk(entries: XmlNode[], depth: number): string {
    if (depth > 120)
      throw new StudyError("Document nesting exceeds the processing limit.");
    let text = "";
    for (const item of entries)
      for (const [tag, children] of Object.entries(item)) {
        if (tag === "#text") {
          text += String(children);
          continue;
        }
        if (!Array.isArray(children)) continue;
        if (tag === "w:tab" || tag === "w:br") {
          text += " ";
          continue;
        }
        const body = walk(children, depth + 1);
        if (tag === "w:p" || tag === "a:p") {
          if (body.trim()) out.push(body.trim());
        } else text += body;
      }
    return text;
  }
  walk(nodes, 0);
  return out;
}
export async function extractDocument(
  buffer: Buffer,
  kind: keyof typeof mime,
): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  let total = 0;
  function append(reference: string, text: string) {
    const clean = text.replaceAll("\u0000", "").trim();
    if (!clean) return;
    total += clean.length;
    if (total > 2000000)
      throw new StudyError(
        "Document text exceeds the two-million-character extraction limit.",
      );
    for (let start = 0; start < clean.length; start += 3500)
      chunks.push({
        reference,
        body: clean.slice(start, start + 3500),
        position: chunks.length,
      });
  }
  if (kind === "pdf") {
    const output = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        process.execPath,
        [
          "--max-old-space-size=256",
          join(process.cwd(), "scripts", "extract-pdf.cjs"),
        ],
        { timeout: 45000, maxBuffer: 10 * 1024 * 1024, windowsHide: true },
        (error, stdout) => {
          if (error)
            reject(
              new StudyError(
                "Unable to read this PDF. Check that it is unlocked and under 600 pages.",
              ),
            );
          else resolve(stdout);
        },
      );
      child.stdin?.on("error", () => {});
      child.stdin?.end(buffer);
    });
    const pages = JSON.parse(output) as { num: number; text: string }[];
    for (const page of pages) append("Page " + page.num, page.text);
  } else {
    const parts = await officeParts(buffer, kind);
    if (kind === "docx") {
      const lines = paragraphs(parts.get("word/document.xml")!);
      for (let i = 0; i < lines.length; i += 12)
        append(
          "Paragraphs " + (i + 1) + "–" + Math.min(i + 12, lines.length),
          lines.slice(i, i + 12).join("\n"),
        );
    } else {
      for (const [position, xml] of slidesInPresentationOrder(parts).entries())
        append("Slide " + (position + 1), paragraphs(xml).join("\n"));
    }
  }
  if (!chunks.length)
    throw new StudyError(
      kind === "pdf"
        ? "No readable text was found. Scanned PDFs require OCR, which this MVP does not include."
        : "No readable text was found.",
    );
  return chunks;
}
export async function validateOffice(buffer: Buffer, kind: keyof typeof mime) {
  if (kind !== "pdf") await officeParts(buffer, kind);
}
