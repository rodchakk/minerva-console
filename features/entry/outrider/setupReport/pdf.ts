import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type {
  OutriderSetupReportSnapshot,
  SetupFinding,
} from "@/features/entry/outrider/setupReport/model";

type Cursor = {
  page: PDFPage;
  y: number;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const LINE_HEIGHT = 15;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function addPage(doc: PDFDocument, cursor: Cursor) {
  cursor.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  cursor.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(doc: PDFDocument, cursor: Cursor, height: number) {
  if (cursor.y - height < MARGIN) {
    addPage(doc, cursor);
  }
}

function drawText(
  doc: PDFDocument,
  cursor: Cursor,
  text: string,
  options: {
    color?: ReturnType<typeof rgb>;
    font: PDFFont;
    maxWidth?: number;
    size: number;
  },
) {
  const maxWidth = options.maxWidth ?? PAGE_WIDTH - MARGIN * 2;
  const lines = wrapText(text, options.font, options.size, maxWidth);
  ensureSpace(doc, cursor, lines.length * LINE_HEIGHT + 4);

  for (const line of lines) {
    cursor.page.drawText(line, {
      color: options.color ?? rgb(0.13, 0.15, 0.2),
      font: options.font,
      size: options.size,
      x: MARGIN,
      y: cursor.y,
    });
    cursor.y -= LINE_HEIGHT;
  }
}

function sectionTitle(
  doc: PDFDocument,
  cursor: Cursor,
  text: string,
  fonts: { bold: PDFFont },
) {
  cursor.y -= 10;
  drawText(doc, cursor, text, {
    color: rgb(0.08, 0.09, 0.13),
    font: fonts.bold,
    size: 13,
  });
  cursor.y -= 2;
}

function bullet(
  doc: PDFDocument,
  cursor: Cursor,
  text: string,
  fonts: { regular: PDFFont },
) {
  drawText(doc, cursor, `- ${text}`, {
    font: fonts.regular,
    maxWidth: PAGE_WIDTH - MARGIN * 2 - 8,
    size: 10,
  });
}

function findingText(finding: SetupFinding) {
  const location = [
    finding.sheet,
    finding.row ? `fila ${finding.row}` : null,
    finding.field,
  ]
    .filter(Boolean)
    .join(" / ");
  return `${location ? `${location}: ` : ""}${finding.message}`;
}

export async function renderSetupReportPdf(
  snapshot: OutriderSetupReportSnapshot,
) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const cursor: Cursor = {
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
  };

  cursor.page.drawText("ENTRY", {
    color: rgb(0.1, 0.1, 0.12),
    font: bold,
    size: 18,
    x: MARGIN,
    y: cursor.y,
  });
  cursor.y -= 30;

  drawText(doc, cursor, "Reporte preliminar de configuración", {
    color: rgb(0.1, 0.1, 0.12),
    font: bold,
    size: 22,
  });
  drawText(doc, cursor, snapshot.intake.communityName, {
    color: rgb(0.22, 0.25, 0.32),
    font: regular,
    size: 12,
  });

  cursor.y -= 14;
  cursor.page.drawRectangle({
    color: rgb(0.99, 0.91, 0.68),
    height: 44,
    width: PAGE_WIDTH - MARGIN * 2,
    x: MARGIN,
    y: cursor.y - 34,
  });
  cursor.page.drawText("PRELIMINAR", {
    color: rgb(0.28, 0.18, 0.03),
    font: bold,
    size: 12,
    x: MARGIN + 16,
    y: cursor.y - 12,
  });
  cursor.page.drawText("AÚN NO APLICADO A ENTRY", {
    color: rgb(0.28, 0.18, 0.03),
    font: bold,
    size: 12,
    x: MARGIN + 16,
    y: cursor.y - 28,
  });
  cursor.y -= 58;

  sectionTitle(doc, cursor, "1. Resumen ejecutivo", { bold });
  bullet(doc, cursor, `${snapshot.summary.units} viviendas/unidades identificadas.`, {
    regular,
  });
  bullet(
    doc,
    cursor,
    `${snapshot.summary.residentRows} registros de residentes recibidos; cobertura: ${
      snapshot.summary.residentCoveragePercent === null
        ? "sin datos"
        : `${snapshot.summary.residentCoveragePercent}%`
    }.`,
    { regular },
  );
  bullet(
    doc,
    cursor,
    `${snapshot.summary.destinationRows} destinos/establecimientos y ${snapshot.summary.adminRows} administradores iniciales.`,
    { regular },
  );
  bullet(
    doc,
    cursor,
    `${snapshot.summary.warnings} observaciones requieren revisión antes de aplicar información operativa.`,
    { regular },
  );

  sectionTitle(doc, cursor, "2. Fuentes utilizadas", { bold });
  bullet(doc, cursor, `Outrider: ${snapshot.intake.communityName}`, { regular });
  bullet(doc, cursor, `Workbook: ${snapshot.source.filename}`, { regular });
  bullet(doc, cursor, `Versión de reporte: ${snapshot.source.versionLabel}`, {
    regular,
  });
  bullet(doc, cursor, `SHA fuente: ${snapshot.source.sha256Prefix}`, { regular });

  sectionTitle(doc, cursor, "3. Resumen de configuración", { bold });
  bullet(doc, cursor, `Unidades: ${snapshot.summary.units}`, { regular });
  bullet(doc, cursor, `Referencias visibles: ${snapshot.summary.unitsWithReferences}`, {
    regular,
  });
  bullet(
    doc,
    cursor,
    `Referencias pendientes: ${snapshot.summary.unitsMissingReferences}`,
    { regular },
  );
  bullet(doc, cursor, `Personal de seguridad declarado: ${snapshot.intake.securityStaffCount ?? "no indicado"}`, {
    regular,
  });

  sectionTitle(doc, cursor, "4. Nomenclatura y referencias", { bold });
  drawText(
    doc,
    cursor,
    `Ejemplo declarado en Outrider: ${snapshot.intake.unitNamingExample ?? "no indicado"}. Las etiquetas del workbook se usan solo como identificadores explícitos; no se infiere significado operativo de su sintaxis.`,
    { font: regular, size: 10 },
  );

  sectionTitle(doc, cursor, "5. Datos confirmados", { bold });
  bullet(doc, cursor, "El workbook define una lista normalizada de unidades.", {
    regular,
  });
  bullet(doc, cursor, "El PDF resume residentes por cobertura y conteos, sin directorio PII.", {
    regular,
  });
  bullet(doc, cursor, "Este reporte no crea casas, residentes, guardias, destinos ni usuarios.", {
    regular,
  });

  sectionTitle(doc, cursor, "6. Observaciones y datos pendientes", { bold });
  const warnings = snapshot.validation.findings.filter(
    (finding) => finding.severity !== "info",
  );
  if (warnings.length === 0) {
    bullet(doc, cursor, "No hay observaciones pendientes.", { regular });
  } else {
    for (const warning of warnings.slice(0, 18)) {
      bullet(doc, cursor, findingText(warning), { regular });
    }
    if (warnings.length > 18) {
      bullet(doc, cursor, `${warnings.length - 18} observaciones adicionales en revisión interna.`, {
        regular,
      });
    }
  }

  sectionTitle(doc, cursor, "7. Próximo paso recomendado", { bold });
  drawText(doc, cursor, snapshot.recommendation, { font: regular, size: 10 });

  sectionTitle(doc, cursor, "8. Appendix / Listado de unidades", { bold });
  for (const unit of snapshot.workbook.units.slice(0, 80)) {
    bullet(
      doc,
      cursor,
      `${unit.unitLabel ?? "Sin etiqueta"} | ${unit.publicReference ?? "Sin referencia"} | ${unit.unitType ?? "tipo no indicado"} | ${
        unit.isActive === null ? "estado no indicado" : unit.isActive ? "activa" : "inactiva"
      }`,
      { regular },
    );
  }
  if (snapshot.workbook.units.length > 80) {
    bullet(doc, cursor, `${snapshot.workbook.units.length - 80} unidades adicionales omitidas del PDF compacto.`, {
      regular,
    });
  }

  const pages = doc.getPages();
  pages.forEach((page, index) => {
    page.drawText(
      `Minerva Technologies | ${snapshot.source.versionLabel} | ${new Date(
        snapshot.generatedAt,
      ).toISOString()} | ${snapshot.source.sha256Prefix} | ${index + 1}/${pages.length}`,
      {
        color: rgb(0.45, 0.48, 0.54),
        font: regular,
        size: 8,
        x: MARGIN,
        y: 24,
      },
    );
  });

  return Buffer.from(await doc.save());
}
