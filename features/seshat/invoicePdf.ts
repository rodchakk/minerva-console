import type { InvoiceDocumentLanguage } from "./invoicePresentation";

const A4_WIDTH_POINTS = 595.28;
const A4_HEIGHT_POINTS = 841.89;
const PDF_MARGIN_POINTS = 24;

export function invoicePdfFilename(invoiceNumber: string, language: InvoiceDocumentLanguage) {
  const safeInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  const languageSuffix = language === "es-HN" ? "es" : "en";
  return `${safeInvoiceNumber || "invoice"}-${languageSuffix}.pdf`;
}

export async function createInvoicePdfBytes(
  pngDataUrl: string,
  sourceWidth: number,
  sourceHeight: number,
) {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(pngDataUrl);
  const page = pdf.addPage([A4_WIDTH_POINTS, A4_HEIGHT_POINTS]);
  const availableWidth = A4_WIDTH_POINTS - PDF_MARGIN_POINTS * 2;
  const availableHeight = A4_HEIGHT_POINTS - PDF_MARGIN_POINTS * 2;
  const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: A4_WIDTH_POINTS,
    height: A4_HEIGHT_POINTS,
    color: rgb(1, 1, 1),
  });
  page.drawImage(image, {
    x: (A4_WIDTH_POINTS - renderedWidth) / 2,
    y: A4_HEIGHT_POINTS - PDF_MARGIN_POINTS - renderedHeight,
    width: renderedWidth,
    height: renderedHeight,
  });

  return pdf.save();
}

async function waitForDocumentImages(node: HTMLElement) {
  await Promise.all(
    Array.from(node.querySelectorAll("img")).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
}

export async function downloadInvoicePdf({
  node,
  invoiceNumber,
  language,
}: {
  node: HTMLElement;
  invoiceNumber: string;
  language: InvoiceDocumentLanguage;
}) {
  if ("fonts" in document) await document.fonts.ready;
  await waitForDocumentImages(node);

  const width = node.scrollWidth;
  const height = node.scrollHeight;
  const { toPng } = await import("html-to-image");
  const pngDataUrl = await toPng(node, {
    backgroundColor: "#ffffff",
    cacheBust: true,
    pixelRatio: 2,
    width,
    height,
    style: {
      border: "0",
      borderRadius: "0",
      boxShadow: "none",
      margin: "0",
    },
  });
  const bytes = await createInvoicePdfBytes(pngDataUrl, width, height);
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = invoicePdfFilename(invoiceNumber, language);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
