import { Capacitor } from "@capacitor/core";
import type { PDFDocumentProxy } from "pdfjs-dist";

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export async function loadPdfDocument(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  return pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
}

export async function renderPage(
  document: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.5,
): Promise<void> {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("No se pudo crear el contexto 2D.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, canvas }).promise;
}

export async function renderPageToImageData(
  document: PDFDocumentProxy,
  pageNumber: number,
  scale = 2,
): Promise<ImageData> {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!context) throw new Error("No se pudo crear el contexto 2D.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (Capacitor.isNativePlatform()) {
    void saveBlobNative(blob, filename, "Guardar archivo de Atril").catch((error) => {
      console.error("No se pudo guardar el archivo en el dispositivo.", error);
      fallbackDownload(blob, filename);
    });
    return;
  }
  fallbackDownload(blob, filename);
}

export function openBlob(blob: Blob, filename = "partitura.pdf"): void {
  if (Capacitor.isNativePlatform()) {
    void saveBlobNative(blob, filename, "Abrir con otra aplicación").catch((error) => {
      console.error("No se pudo abrir el archivo en el dispositivo.", error);
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function printBlob(blob: Blob, filename = "partitura.pdf"): void {
  if (Capacitor.isNativePlatform()) {
    // El WebView de Android no tiene diálogo de impresión propio: guardamos el
    // PDF y abrimos el selector del sistema para imprimirlo desde otra app.
    void saveBlobNative(blob, filename, "Guardar o imprimir").catch((error) => {
      console.error("No se pudo preparar la impresión.", error);
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
  };
  document.body.appendChild(frame);
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 120000);
}

function fallbackDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function sanitizeFilename(filename: string): string {
  const clean = filename.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").trim();
  return clean || "atril-archivo";
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunk = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/**
 * Guarda un archivo en el dispositivo Android.
 *
 * Primero intenta la carpeta pública de Documentos (funciona en Android 10 o
 * anterior con el permiso de almacenamiento). Si el sistema lo impide (Android
 * 11+ con almacenamiento por aplicación), deja una copia en la carpeta privada
 * de Atril y abre el selector del sistema para que el usuario elija Descargas,
 * Drive, WhatsApp, etc.
 */
async function saveBlobNative(blob: Blob, filename: string, dialogTitle: string): Promise<void> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const name = sanitizeFilename(filename);
  const data = await blobToBase64(blob);

  try {
    await Filesystem.requestPermissions();
  } catch {
    // En Android 11+ el permiso de almacenamiento ya no es necesario.
  }

  try {
    await Filesystem.writeFile({
      path: `Atril/${name}`,
      data,
      directory: Directory.Documents,
      recursive: true,
    });
    return;
  } catch {
    // Sin acceso a Documentos: seguimos con la carpeta de la app + compartir.
  }

  let uri: string;
  try {
    const saved = await Filesystem.writeFile({
      path: `Atril/${name}`,
      data,
      directory: Directory.External,
      recursive: true,
    });
    uri = saved.uri;
  } catch {
    const cached = await Filesystem.writeFile({
      path: name,
      data,
      directory: Directory.Cache,
      recursive: true,
    });
    uri = cached.uri;
  }

  const { Share } = await import("@capacitor/share");
  try {
    await Share.share({
      title: name,
      text: "Archivo guardado desde Atril",
      url: uri,
      dialogTitle,
    });
  } catch {
    // El usuario canceló el selector del sistema.
  }
}

export function arrayBufferOf(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}
