"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { api, message } from "./request";
export function PdfViewer({ id }: { id: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    (async () => {
      try {
        const { url } = await api<{ url: string }>("file-url", { id });
        const pdf = await import("pdfjs-dist");
        if (!active) return;
        pdf.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        task = pdf.getDocument({ url });
        const result = await task.promise;
        if (active) setDoc(result);
      } catch (e) {
        if (active) setError(message(e));
      }
    })();
    return () => {
      active = false;
      void task?.destroy();
    };
  }, [id]);
  useEffect(() => {
    if (!doc) return;
    let active = true;
    let render: import("pdfjs-dist").RenderTask | undefined;
    (async () => {
      try {
        const p = await doc.getPage(page);
        if (!active || !canvas.current) return;
        const view = p.getViewport({ scale: zoom });
        const el = canvas.current;
        el.width = view.width;
        el.height = view.height;
        render = p.render({ canvas: el, viewport: view });
        await render.promise;
      } catch (e) {
        if (active) setError(message(e));
      }
    })();
    return () => {
      active = false;
      render?.cancel();
    };
  }, [doc, page, zoom]);
  return (
    <div className="panel">
      <div className="toolbar">
        <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
          Previous
        </button>
        <span>
          Page {page} / {doc?.numPages ?? "…"}
        </span>
        <button
          disabled={!doc || page >= doc.numPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
        <button disabled={zoom <= 0.5} onClick={() => setZoom((z) => z - 0.25)}>
          Zoom out
        </button>
        <button disabled={zoom >= 2.5} onClick={() => setZoom((z) => z + 0.25)}>
          Zoom in
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="pdf-scroll">
        <canvas ref={canvas} aria-label={"PDF page " + page} />
      </div>
    </div>
  );
}
