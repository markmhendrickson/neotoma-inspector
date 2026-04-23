import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { InlineSkeleton, QueryErrorAlert } from "@/components/shared/query_status";

GlobalWorkerOptions.workerSrc = pdfWorker;

function sameOriginAsWindow(url: string): boolean {
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

interface PdfJsInlinePreviewProps {
  /** Blob object URL or absolute HTTP(S) URL the worker can fetch. */
  documentUrl: string;
}

/**
 * Renders the first PDF page with PDF.js instead of a native PDF `<iframe>`.
 * Chrome’s built-in PDF viewer inside an iframe consumes the browser Back stack;
 * canvas rendering avoids that while still offering a full-document escape hatch.
 */
export function PdfJsInlinePreview({ documentUrl }: PdfJsInlinePreviewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let pdfDoc: PDFDocumentProxy | null = null;
    const loadingTask = getDocument({
      url: documentUrl,
      withCredentials: sameOriginAsWindow(documentUrl),
    });

    async function run() {
      setStatus("loading");
      setErrorMessage(null);
      setNumPages(0);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      try {
        pdfDoc = await loadingTask.promise;
        if (cancelled) {
          await pdfDoc.destroy().catch(() => {});
          return;
        }

        setNumPages(pdfDoc.numPages);
        const page = await pdfDoc.getPage(1);
        if (cancelled) return;

        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
        if (cancelled) return;

        const c = canvasRef.current;
        const w = wrapRef.current;
        if (!c || !w) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const maxW = Math.max(320, (w.clientWidth || 800) - 8);
        const scale = Math.min(maxW / baseViewport.width, 2);
        const viewport = page.getViewport({ scale });

        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");

        c.width = Math.floor(viewport.width);
        c.height = Math.floor(viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) return;
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(e instanceof Error ? e.message : String(e));
      }
    }

    void run();

    return () => {
      cancelled = true;
      void pdfDoc?.destroy().catch(() => {});
      loadingTask.destroy();
    };
  }, [documentUrl]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="max-w-xl text-xs text-muted-foreground">
          Page 1 is drawn with PDF.js (no PDF iframe), so the browser Back button returns to the prior app route.
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href={documentUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 inline h-3 w-3 align-middle" />
            Open full PDF
          </a>
        </Button>
      </div>

      {status === "error" && errorMessage ? (
        <QueryErrorAlert title="PDF preview failed">{errorMessage}</QueryErrorAlert>
      ) : null}

      <div ref={wrapRef} className="max-h-[720px] overflow-auto rounded-md border bg-muted/20 p-2">
        {status === "loading" ? (
          <InlineSkeleton className="mx-auto my-8 block h-64 w-full max-w-lg" />
        ) : null}
        <canvas
          ref={canvasRef}
          className={`mx-auto block max-w-full ${status === "ready" ? "" : "hidden"}`}
          aria-hidden={status !== "ready"}
        />
      </div>

      {numPages > 1 ? (
        <p className="text-xs text-muted-foreground">
          Page 1 of {numPages}. Use “Open full PDF” for the whole document in a new tab.
        </p>
      ) : null}
    </div>
  );
}
