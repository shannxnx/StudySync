/* Standalone worker: untrusted PDFs are parsed outside the Next.js request process. */
async function main() {
  const { PDFParse } = await import("pdf-parse");
  const input = [];
  for await (const chunk of process.stdin) input.push(chunk);
  const parser = new PDFParse({
    data: new Uint8Array(Buffer.concat(input)),
    isEvalSupported: false,
    verbosity: 0,
  });
  try {
    const info = await parser.getInfo();
    if (info.total > 600) throw new Error("PDF page limit");
    const result = await parser.getText({ pageJoiner: "" });
    if (result.text.length > 2000000) throw new Error("PDF text limit");
    process.stdout.write(JSON.stringify(result.pages));
  } finally {
    await parser.destroy();
  }
}
main().catch(() => {
  process.exitCode = 1;
});
