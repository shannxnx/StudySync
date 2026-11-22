import { zipSync, strToU8 } from "fflate";
export function office(
  kind: "docx" | "pptx",
  text = "Water moves through evaporation, condensation, and precipitation.",
) {
  const doc = kind === "docx";
  const key = doc ? "word/document.xml" : "ppt/slides/slide1.xml";
  return Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8(
        '<Types><Override PartName="/' +
          key +
          '" ContentType="application/vnd.openxmlformats-officedocument.' +
          (doc ? "wordprocessingml.document" : "presentationml.presentation") +
          '.main+xml"/></Types>',
      ),
      ...(!doc && {
        "ppt/presentation.xml": strToU8(
          '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="slideA"/></p:sldIdLst></p:presentation>',
        ),
        "ppt/_rels/presentation.xml.rels": strToU8(
          '<Relationships><Relationship Id="slideA" Target="slides/slide1.xml"/></Relationships>',
        ),
      }),
      [key]: strToU8(
        doc
          ? "<w:document><w:body><w:p><w:r><w:t>" +
              text +
              "</w:t></w:r></w:p></w:body></w:document>"
          : "<p:sld><a:p><a:r><a:t>" + text + "</a:t></a:r></a:p></p:sld>",
      ),
    }),
  );
}
export function pdf(text: string) {
  const stream = "BT /F1 12 Tf 35 700 Td (" + text + ") Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body));
    body += i + 1 + " 0 obj\n" + obj + "\nendobj\n";
  });
  const start = Buffer.byteLength(body);
  body +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" +
    start +
    "\n%%EOF";
  return Buffer.from(body);
}
