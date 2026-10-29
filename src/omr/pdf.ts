import { analyzeImage, type OmrPageResult } from "./analyze";
import { getPdfjs, loadPdfDocument, renderPageToImageData } from "../lib/pdf";
import type { Clef } from "../lib/music";

export type AnalyzePdfOptions = {
  pages?: number[] | "all";
  scale?: number;
  fallbackClef?: Clef;
  onProgress?: (done: number, total: number, message: string) => void;
};

export async function analyzePdf(data: ArrayBuffer, options: AnalyzePdfOptions = {}): Promise<OmrPageResult[]> {
  const pdfjs = await getPdfjs();
  const document = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
  const total = document.numPages;
  const pages = options.pages === "all" || !options.pages ? Array.from({ length: total }, (_, index) => index + 1) : options.pages;
  const results: OmrPageResult[] = [];
  options.onProgress?.(0, pages.length, "Abriendo el PDF…");

  for (let index = 0; index < pages.length; index++) {
    const pageNumber = pages[index];
    options.onProgress?.(index, pages.length, `Rasterizando la página ${pageNumber}…`);
    const image = await renderPageToImageData(document, pageNumber, options.scale ?? 2);
    options.onProgress?.(index + 0.5, pages.length, `Detectando pentagramas y notas en la página ${pageNumber}…`);
    const result = analyzeImage(image, { fallbackClef: options.fallbackClef ?? "treble", page: pageNumber });
    results.push(result);
    options.onProgress?.(index + 1, pages.length, `Página ${pageNumber}: ${result.notes.length} notas detectadas.`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  await document.destroy();
  return results;
}

export async function pdfPageCount(data: ArrayBuffer): Promise<number> {
  const document = await loadPdfDocument(data);
  const count = document.numPages;
  await document.destroy();
  return count;
}
