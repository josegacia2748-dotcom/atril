import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Score } from "../lib/types";
import { getPdf } from "../lib/idb";
import { downloadBlob, loadPdfDocument, openBlob, printBlob, renderPage } from "../lib/pdf";
import { generateScorePdf } from "../lib/pdfgen";
import { Callout } from "./UI";

export function PdfViewer({ score }: { score: Score }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1.5);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDocument(null);
    setBlob(null);
    setPage(1);
    setError("");
    if (!score.pdfId) return;

    (async () => {
      setLoading(true);
      try {
        const stored = await getPdf(score.pdfId as string);
        if (cancelled) return;
        if (!stored) {
          setError("El PDF no está en este dispositivo. Los archivos se guardan en el navegador donde se subieron.");
          return;
        }
        const loaded = await loadPdfDocument(await stored.arrayBuffer());
        if (cancelled) {
          await loaded.destroy();
          return;
        }
        setBlob(stored);
        setDocument(loaded);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudo abrir el PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [score.id, score.pdfId]);

  useEffect(() => {
    return () => {
      if (document) void document.destroy();
    };
  }, [document]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!document || !canvas) return;
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await renderPage(document, page, canvas, zoom);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudo dibujar la página.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [document, page, zoom]);

  const totalPages = document?.numPages ?? score.pages ?? 1;

  const ensureGenerated = async (): Promise<Blob | null> => {
    if (blob) return blob;
    try {
      const generatedBlob = await generateScorePdf(score);
      setBlob(generatedBlob);
      setGenerated(true);
      return generatedBlob;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo generar el PDF.");
      return null;
    }
  };

  const onDownload = async () => {
    const target = await ensureGenerated();
    if (target) downloadBlob(target, `${score.title.replace(/[^\w\- ]+/g, "").trim() || "partitura"}.pdf`);
  };

  const onPrint = async () => {
    const target = await ensureGenerated();
    if (target) printBlob(target);
  };

  const onOpen = async () => {
    const target = await ensureGenerated();
    if (target) openBlob(target);
  };

  if (!score.pdfId) {
    return (
      <div className="stack">
        <Callout tone="info" icon="🖨">
          Esta partitura no tiene un PDF adjunto. Podés generar una versión imprimible a partir de la notación
          analizada, descargarla o imprimirla.
        </Callout>
        <div className="row wrap">
          <button type="button" className="btn primary" onClick={onDownload}>
            ⬇ Descargar PDF generado
          </button>
          <button type="button" className="btn" onClick={onPrint}>
            🖨 Imprimir
          </button>
          <button type="button" className="btn ghost" onClick={onOpen}>
            Abrir en otra pestaña
          </button>
        </div>
        {generated ? <div className="small muted">PDF generado en este dispositivo con la librería jsPDF.</div> : null}
        {error ? <Callout tone="warn">{error}</Callout> : null}
      </div>
    );
  }

  return (
    <div className="viewer-frame">
      <div className="viewer-toolbar">
        <button type="button" className="btn small ghost" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
          ← Anterior
        </button>
        <span className="mono">
          Página {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn small ghost"
          onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          disabled={page >= totalPages}
        >
          Siguiente →
        </button>
        <span className="spacer" />
        <button type="button" className="btn small ghost" onClick={() => setZoom((value) => Math.max(0.6, value - 0.25))}>
          −
        </button>
        <span className="mono">{Math.round(zoom * 100)}%</span>
        <button type="button" className="btn small ghost" onClick={() => setZoom((value) => Math.min(4, value + 0.25))}>
          ＋
        </button>
        <button type="button" className="btn small" onClick={onDownload}>
          ⬇ Descargar
        </button>
        <button type="button" className="btn small" onClick={onPrint}>
          🖨 Imprimir
        </button>
      </div>
      <div className="viewer-body">
        {loading ? <div className="small muted" style={{ padding: 20 }}>Abriendo el PDF…</div> : null}
        {error ? <Callout tone="warn">{error}</Callout> : null}
        <canvas ref={canvasRef} style={{ display: error ? "none" : "block" }} />
      </div>
      {score.pdfName ? <div className="viewer-toolbar">Archivo: {score.pdfName}</div> : null}
    </div>
  );
}
