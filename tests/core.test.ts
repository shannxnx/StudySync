import test from "node:test";
import assert from "node:assert/strict";
import { office, pdf } from "./doc-fixtures";
import { strToU8, unzipSync, zipSync } from "fflate";

test("slide references follow the presentation order after slides are rearranged", async () => {
  const files = unzipSync(office("pptx", "This is the second slide."));
  files["ppt/slides/slide8.xml"] = strToU8(
    "<p:sld><a:p><a:r><a:t>This is first.</a:t></a:r></a:p></p:sld>",
  );
  files["ppt/presentation.xml"] = strToU8(
    '<p:presentation><p:sldIdLst><p:sldId id="264" r:id="B"/><p:sldId id="256" r:id="A"/></p:sldIdLst></p:presentation>',
  );
  files["ppt/_rels/presentation.xml.rels"] = strToU8(
    '<Relationships><Relationship Id="A" Target="slides/slide1.xml"/><Relationship Id="B" Target="slides/slide8.xml"/></Relationships>',
  );
  const chunks = await extractDocument(Buffer.from(zipSync(files)), "pptx");
  assert.deepEqual(
    chunks.map((c) => [c.reference, c.body]),
    [
      ["Slide 1", "This is first."],
      ["Slide 2", "This is the second slide."],
    ],
  );
});
import {
  fileKind,
  extractDocument,
  validateOffice,
  mime,
  maxBytes,
} from "../lib/documents";
import { cleanNote } from "../lib/notes";
import {
  generateStudy,
  selectEvidence,
  validateGenerated,
} from "../lib/generation";
import { generatorInput, subjectInput, type Generation } from "../lib/study";
const base: Generation = {
  id: crypto.randomUUID(),
  subject: crypto.randomUUID(),
  kind: "quiz",
  materials: [crypto.randomUUID()],
  notes: [],
  format: "Quick summary",
  difficulty: "Easy",
  count: 5,
  types: ["choice"],
};
const evidence = [
  {
    text: "Evaporation turns liquid water into vapor.",
    label: "Lecture · Page 2",
    group: "a",
  },
];
const question = {
  question: "What process turns water into vapor?",
  kind: "choice",
  options: ["Evaporation", "Precipitation", "Condensation", "Freezing"],
  correct: 0,
  reference: "S1",
  explanation: "Liquid water evaporates.",
};
test("subject and generator input constraints", () => {
  assert(!subjectInput.safeParse({ name: " " }).success);
  assert(generatorInput.safeParse(base).success);
  assert(
    !generatorInput.safeParse({ ...base, notes: [], materials: [] }).success,
  );
});
test("upload validation checks size, MIME, extension and signature", () => {
  const bytes = office("docx");
  assert.equal(
    fileKind("lecture.docx", bytes.length, mime.docx, bytes),
    "docx",
  );
  assert.throws(() => fileKind("bad.pdf", bytes.length, mime.pdf, bytes));
  assert.throws(() => fileKind("big.docx", maxBytes() + 1, mime.docx, bytes));
  assert.throws(() => fileKind("wrong.docx", bytes.length, mime.pptx, bytes));
});
test("PDF extraction preserves pages and explains scans without OCR", async () => {
  const result = await extractDocument(
    pdf("Evaporation is a phase change."),
    "pdf",
  );
  assert.match(result[0].body, /Evaporation/);
  assert.equal(result[0].reference, "Page 1");
  await assert.rejects(() => extractDocument(pdf(""), "pdf"), /OCR/);
});
test("DOCX and PPTX extraction preserves source locations", async () => {
  for (const kind of ["docx", "pptx"] as const) {
    const result = await extractDocument(office(kind), kind);
    assert.match(result[0].body, /condensation/);
    assert.match(
      result[0].reference,
      kind === "docx" ? /Paragraphs/ : /Slide 1/,
    );
  }
  await assert.rejects(
    () => validateOffice(office("pptx"), "docx"),
    /incorrect/,
  );
});
test("notes retain safe formatting and derive their own plain text", () => {
  const v = cleanNote({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "One",
            marks: [
              { type: "bold" },
              { type: "link", attrs: { href: "about:blank" } },
            ],
          },
          { type: "hardBreak" },
          { type: "text", text: "Two" },
        ],
      },
    ],
  });
  assert.equal(v.plain_text, "One\nTwo");
  assert.deepEqual(v.content.content?.[0].content?.[0].marks, [
    { type: "bold" },
  ]);
  assert.throws(() => cleanNote({ type: "image" }));
});
test("partial coverage is disclosed and represents each source", () => {
  const { excerpts, coverage } = selectEvidence(
    [
      ...evidence,
      { ...evidence[0], label: "B", group: "b", text: "x".repeat(9000) },
    ],
    1000,
  );
  assert.match(coverage, /Partial/);
  assert.equal(new Set(excerpts.map((e) => e.label)).size, 2);
});
test("a short note leaves room for the complete longer reading", () => {
  const sources = [
    { label: "Note", text: "n".repeat(50), group: "note" },
    { label: "Chapter", text: "c".repeat(950), group: "chapter" },
  ];
  const { excerpts, coverage } = selectEvidence(sources, 1000);
  assert.deepEqual(
    excerpts.map((row) => row.text.length),
    [50, 950],
  );
  assert.match(coverage, /All selected/);
});
test("detailed reviewers retry incomplete sections and retain study aids with their citation", async () => {
  const section = {
    heading: "Evaporation",
    body: evidence[0].text,
    reference: "S1",
  };
  const extra = {
    keyPoints: ["The starting state is liquid."],
    selfCheck: {
      question: "What state does the water enter?",
      answer: "It becomes vapor.",
    },
  };
  let calls = 0;
  const result = await generateStudy(
    { ...base, kind: "reviewer", format: "Detailed reviewer" },
    evidence,
    async (_prompt, schema) => {
      assert.doesNotMatch(JSON.stringify(schema), /"(maxItems|maxLength)"/);
      calls++;
      return JSON.stringify({
        sufficient: true,
        title: "Water",
        sections: [calls === 1 ? section : { ...section, ...extra }],
      });
    },
  );
  assert.equal(calls, 2);
  assert.deepEqual(result.sections, [
    { ...section, ...extra, reference: evidence[0].label },
  ]);
});
test("quiz validation rejects invalid labels, answer ranges and counts", () => {
  const options = {
    sufficient: true,
    title: "Water",
    questions: Array(5).fill(question),
  };
  const { excerpts, coverage } = selectEvidence(evidence);
  for (const change of [
    { correct: 9 },
    { reference: "unknown" },
    { options: ["A", "A", "B", "C"] },
  ])
    assert.throws(() =>
      validateGenerated(
        { ...options, questions: Array(5).fill({ ...question, ...change }) },
        base,
        excerpts,
        coverage,
      ),
    );
  assert.throws(() =>
    validateGenerated({ ...options, questions: [] }, base, excerpts, coverage),
  );
});
test("Gemini can retry malformed output, map citations, and reject insufficient evidence", async () => {
  let calls = 0;
  const result = await generateStudy(base, evidence, async () =>
    ++calls === 1
      ? "{"
      : JSON.stringify({
          sufficient: true,
          title: "Water",
          questions: Array(5).fill(question),
        }),
  );
  assert.equal(calls, 2);
  assert.equal(result.questions?.[0].reference, evidence[0].label);
  const review = await generateStudy(
    { ...base, kind: "reviewer" },
    evidence,
    async () =>
      JSON.stringify({
        sufficient: true,
        title: "Summary",
        sections: [
          {
            heading: "Evaporation",
            body: "Liquid becomes vapor.",
            reference: "S1",
          },
        ],
      }),
  );
  assert.equal(review.sections?.[0].reference, evidence[0].label);
  await assert.rejects(
    () =>
      generateStudy({ ...base, kind: "reviewer" }, evidence, async () =>
        JSON.stringify({
          sufficient: false,
          title: "Insufficient",
          sections: [],
        }),
      ),
    /enough information/,
  );
});
