import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type {
  OutriderSetupReportSnapshot,
  SetupFinding,
} from "@/features/entry/outrider/setupReport/model";
import { normalizeSetupUnitIdentity } from "@/features/entry/outrider/setupReport/normalization";

type Cursor = {
  page: PDFPage;
  y: number;
};

type Fonts = {
  bold: PDFFont;
  regular: PDFFont;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const LINE_HEIGHT = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
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
  return lines.length > 0 ? lines : [""];
}

function addPage(doc: PDFDocument, cursor: Cursor) {
  cursor.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  cursor.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(doc: PDFDocument, cursor: Cursor, height: number) {
  if (cursor.y - height < MARGIN + 18) {
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
    x?: number;
  },
) {
  const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
  const lines = wrapText(text, options.font, options.size, maxWidth);
  ensureSpace(doc, cursor, lines.length * LINE_HEIGHT + 4);

  for (const line of lines) {
    cursor.page.drawText(line, {
      color: options.color ?? rgb(0.12, 0.14, 0.18),
      font: options.font,
      size: options.size,
      x: options.x ?? MARGIN,
      y: cursor.y,
    });
    cursor.y -= LINE_HEIGHT;
  }
}

function sectionTitle(
  doc: PDFDocument,
  cursor: Cursor,
  text: string,
  fonts: Fonts,
) {
  cursor.y -= 10;
  drawText(doc, cursor, text, {
    color: rgb(0.08, 0.09, 0.13),
    font: fonts.bold,
    size: 13,
  });
  cursor.y -= 3;
}

function bullet(
  doc: PDFDocument,
  cursor: Cursor,
  text: string,
  fonts: Fonts,
) {
  drawText(doc, cursor, `• ${text}`, {
    font: fonts.regular,
    maxWidth: CONTENT_WIDTH - 8,
    size: 10,
  });
}

function plural(count: number, singular: string, pluralValue: string) {
  return count === 1 ? singular : pluralValue;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

function statCard(input: {
  fonts: Fonts;
  label: string;
  page: PDFPage;
  value: string;
  width: number;
  x: number;
  y: number;
}) {
  input.page.drawRectangle({
    borderColor: rgb(0.87, 0.88, 0.91),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.99),
    height: 54,
    width: input.width,
    x: input.x,
    y: input.y - 54,
  });
  input.page.drawText(input.label.toUpperCase(), {
    color: rgb(0.42, 0.45, 0.52),
    font: input.fonts.bold,
    size: 7.5,
    x: input.x + 12,
    y: input.y - 18,
  });
  input.page.drawText(input.value, {
    color: rgb(0.08, 0.09, 0.13),
    font: input.fonts.bold,
    size: 16,
    x: input.x + 12,
    y: input.y - 40,
  });
}

function findingGroups(findings: SetupFinding[]) {
  const groups = new Map<string, number>();
  for (const finding of findings) {
    if (finding.severity === "info") continue;
    groups.set(finding.code, (groups.get(finding.code) ?? 0) + 1);
  }
  return groups;
}

function customerFindingMessages(findings: SetupFinding[]) {
  const groups = findingGroups(findings);
  const messages: string[] = [];

  for (const [code, count] of groups.entries()) {
    switch (code) {
      case "COMMUNITY_NAME_MISMATCH":
        messages.push(
          "El nombre de la comunidad en el archivo preparado por Minerva no coincide exactamente con el registrado en Outrider.",
        );
        break;
      case "UNIT_REFERENCE_MISSING":
        messages.push(
          `${count} ${plural(count, "unidad no tiene", "unidades no tienen")} una referencia visible para residentes.`,
        );
        break;
      case "UNIT_TYPE_MISSING":
        messages.push(
          `${count} ${plural(count, "unidad requiere", "unidades requieren")} confirmar su tipo antes de la configuración final.`,
        );
        break;
      case "UNIT_ACTIVE_UNKNOWN":
        messages.push(
          `${count} ${plural(count, "unidad requiere", "unidades requieren")} confirmar si iniciará activa o inactiva.`,
        );
        break;
      case "RESIDENT_CONTACT_MISSING":
        messages.push(
          `${count} ${plural(count, "registro de residente no tiene", "registros de residentes no tienen")} teléfono ni correo de contacto.`,
        );
        break;
      case "RESIDENT_PROBABLE_DUPLICATE":
        messages.push(
          `${count} ${plural(count, "registro podría estar duplicado", "registros podrían estar duplicados")} y Minerva debe revisarlo antes de activar usuarios.`,
        );
        break;
      case "UNIT_HAS_NO_RESIDENT_INFORMATION":
        messages.push(
          `${count} ${plural(count, "unidad que iniciará activa no tiene", "unidades que iniciarán activas no tienen")} información de residentes.`,
        );
        break;
      case "RESIDENT_COVERAGE_PARTIAL":
        if (!groups.has("UNIT_HAS_NO_RESIDENT_INFORMATION")) {
          messages.push(
            "La información de residentes todavía no cubre todas las unidades que iniciarán activas.",
          );
        }
        break;
      default:
        messages.push(
          `${count} ${plural(count, "observación adicional requiere", "observaciones adicionales requieren")} revisión interna de Minerva antes de aplicar la configuración.`,
        );
        break;
    }
  }

  return messages;
}

function unitStatusLabel(value: boolean | null) {
  if (value === true) return "Activa al inicio";
  if (value === false) return "Inactiva al inicio";
  return "Estado por confirmar";
}

export async function renderSetupReportPdf(
  snapshot: OutriderSetupReportSnapshot,
) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { bold, regular };
  const cursor: Cursor = {
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
  };

  const activeUnits = snapshot.workbook.units.filter(
    (unit) => unit.isActive === true,
  ).length;
  const inactiveUnits = snapshot.workbook.units.filter(
    (unit) => unit.isActive === false,
  ).length;
  const unknownUnits = snapshot.workbook.units.filter(
    (unit) => unit.isActive === null,
  ).length;
  const populationUnits = new Set(
    snapshot.workbook.units
      .filter((unit) => unit.isActive !== false)
      .map((unit) => normalizeSetupUnitIdentity(unit.unitLabel))
      .filter((unit): unit is string => Boolean(unit)),
  );
  const populatedPopulationUnits = new Set(
    snapshot.workbook.residents
      .map((resident) => normalizeSetupUnitIdentity(resident.unitLabel))
      .filter(
        (unit): unit is string => unit !== null && populationUnits.has(unit),
      ),
  ).size;
  const customerFindings = customerFindingMessages(snapshot.validation.findings);
  const readyForFinalReview =
    snapshot.summary.residentCoveragePercent === 100 &&
    customerFindings.length === 0 &&
    unknownUnits === 0;

  cursor.page.drawText("ENTRY", {
    color: rgb(0.08, 0.09, 0.13),
    font: bold,
    size: 18,
    x: MARGIN,
    y: cursor.y,
  });
  cursor.page.drawText("MINERVA TECHNOLOGIES", {
    color: rgb(0.42, 0.45, 0.52),
    font: bold,
    size: 8,
    x: PAGE_WIDTH - MARGIN - 98,
    y: cursor.y + 3,
  });
  cursor.y -= 30;

  drawText(doc, cursor, "Resumen preliminar de preparación", {
    color: rgb(0.08, 0.09, 0.13),
    font: bold,
    size: 21,
  });
  drawText(doc, cursor, snapshot.intake.communityName, {
    color: rgb(0.28, 0.31, 0.38),
    font: regular,
    size: 12,
  });
  if (snapshot.intake.communityCity) {
    drawText(doc, cursor, snapshot.intake.communityCity, {
      color: rgb(0.42, 0.45, 0.52),
      font: regular,
      size: 9,
    });
  }

  cursor.y -= 10;
  cursor.page.drawRectangle({
    color: rgb(1, 0.95, 0.79),
    height: 52,
    width: CONTENT_WIDTH,
    x: MARGIN,
    y: cursor.y - 44,
  });
  cursor.page.drawText("DOCUMENTO PRELIMINAR", {
    color: rgb(0.36, 0.24, 0.03),
    font: bold,
    size: 10,
    x: MARGIN + 14,
    y: cursor.y - 16,
  });
  cursor.page.drawText(
    "Todavía no se ha aplicado ningún cambio a ENTRY.",
    {
      color: rgb(0.36, 0.24, 0.03),
      font: regular,
      size: 9.5,
      x: MARGIN + 14,
      y: cursor.y - 33,
    },
  );
  cursor.y -= 66;

  ensureSpace(doc, cursor, 62);
  const statusColor = readyForFinalReview
    ? rgb(0.89, 0.97, 0.92)
    : rgb(1, 0.95, 0.79);
  const statusTextColor = readyForFinalReview
    ? rgb(0.08, 0.35, 0.19)
    : rgb(0.42, 0.27, 0.03);
  cursor.page.drawRectangle({
    borderColor: readyForFinalReview
      ? rgb(0.65, 0.86, 0.71)
      : rgb(0.91, 0.78, 0.43),
    borderWidth: 1,
    color: statusColor,
    height: 48,
    width: CONTENT_WIDTH,
    x: MARGIN,
    y: cursor.y - 48,
  });
  cursor.page.drawText("ESTADO DE PREPARACIÓN", {
    color: statusTextColor,
    font: bold,
    size: 7.5,
    x: MARGIN + 14,
    y: cursor.y - 17,
  });
  cursor.page.drawText(
    readyForFinalReview ? "Lista para revisión final" : "Con observaciones por revisar",
    {
      color: statusTextColor,
      font: bold,
      size: 13,
      x: MARGIN + 14,
      y: cursor.y - 36,
    },
  );
  cursor.y -= 62;

  drawText(
    doc,
    cursor,
    "Este documento resume la información que Minerva organizó para preparar ENTRY y permite confirmar, de forma sencilla, qué está listo y qué falta revisar antes de la activación.",
    { font: regular, size: 10 },
  );

  sectionTitle(doc, cursor, "Resumen de la comunidad", fonts);
  ensureSpace(doc, cursor, 126);
  const gap = 10;
  const cardWidth = (CONTENT_WIDTH - gap) / 2;
  const top = cursor.y;
  statCard({ fonts, label: "Unidades identificadas", page: cursor.page, value: String(snapshot.summary.units), width: cardWidth, x: MARGIN, y: top });
  statCard({ fonts, label: "Activas al inicio", page: cursor.page, value: String(activeUnits), width: cardWidth, x: MARGIN + cardWidth + gap, y: top });
  statCard({ fonts, label: "Inactivas al inicio", page: cursor.page, value: String(inactiveUnits), width: cardWidth, x: MARGIN, y: top - 64 });
  statCard({
    fonts,
    label: "Cobertura de población",
    page: cursor.page,
    value:
      snapshot.summary.residentCoveragePercent === null
        ? "Pendiente"
        : `${snapshot.summary.residentCoveragePercent}%`,
    width: cardWidth,
    x: MARGIN + cardWidth + gap,
    y: top - 64,
  });
  cursor.y -= 128;

  drawText(
    doc,
    cursor,
    `La cobertura considera las ${populationUnits.size} ${plural(
      populationUnits.size,
      "unidad que iniciará activa o requiere confirmar estado",
      "unidades que iniciarán activas o requieren confirmar estado",
    )}. Las unidades marcadas expresamente como inactivas no se cuentan como faltantes de residentes.`,
    { color: rgb(0.42, 0.45, 0.52), font: regular, size: 8.5 },
  );

  sectionTitle(doc, cursor, "Información preparada", fonts);
  bullet(
    doc,
    cursor,
    `${snapshot.summary.residentRows} ${plural(snapshot.summary.residentRows, "registro de residente recibido", "registros de residentes recibidos")} para ${populatedPopulationUnits} ${plural(populatedPopulationUnits, "unidad de inicio", "unidades de inicio")}.`,
    fonts,
  );
  bullet(
    doc,
    cursor,
    `${snapshot.summary.destinationRows} ${plural(snapshot.summary.destinationRows, "establecimiento o destino identificado", "establecimientos o destinos identificados")}.`,
    fonts,
  );
  bullet(
    doc,
    cursor,
    `${snapshot.summary.adminRows} ${plural(snapshot.summary.adminRows, "administrador inicial preparado", "administradores iniciales preparados")}.`,
    fonts,
  );
  bullet(
    doc,
    cursor,
    `Personal de seguridad informado: ${snapshot.intake.securityStaffCount ?? "pendiente de confirmar"}.`,
    fonts,
  );

  sectionTitle(doc, cursor, "Observaciones antes de activar", fonts);
  if (customerFindings.length === 0) {
    bullet(
      doc,
      cursor,
      "No se identifican pendientes que impidan continuar con la revisión final.",
      fonts,
    );
    if (inactiveUnits > 0) {
      bullet(
        doc,
        cursor,
        `${inactiveUnits} ${plural(inactiveUnits, "unidad está marcada como inactiva", "unidades están marcadas como inactivas")} y no requiere residente para el cálculo de cobertura inicial.`,
        fonts,
      );
    }
  } else {
    for (const message of customerFindings.slice(0, 8)) {
      bullet(doc, cursor, message, fonts);
    }
  }

  sectionTitle(doc, cursor, "Siguiente paso", fonts);
  drawText(doc, cursor, snapshot.recommendation, {
    font: regular,
    size: 10,
  });

  addPage(doc, cursor);
  drawText(doc, cursor, "Detalle para confirmación", {
    color: rgb(0.08, 0.09, 0.13),
    font: bold,
    size: 18,
  });
  drawText(
    doc,
    cursor,
    "Revise este listado para confirmar que las unidades y su estado inicial coinciden con lo esperado antes de la activación.",
    { color: rgb(0.36, 0.39, 0.46), font: regular, size: 10 },
  );

  sectionTitle(doc, cursor, "Listado de unidades", fonts);
  for (const unit of snapshot.workbook.units.slice(0, 100)) {
    const label = unit.publicReference ?? unit.unitLabel ?? "Unidad sin referencia";
    bullet(doc, cursor, `${label} — ${unitStatusLabel(unit.isActive)}`, fonts);
  }
  if (snapshot.workbook.units.length > 100) {
    bullet(
      doc,
      cursor,
      `${snapshot.workbook.units.length - 100} unidades adicionales no se muestran en este resumen compacto.`,
      fonts,
    );
  }

  if (snapshot.workbook.destinations.length > 0) {
    sectionTitle(doc, cursor, "Establecimientos y destinos informados", fonts);
    for (const destination of snapshot.workbook.destinations.slice(0, 20)) {
      if (destination.name) bullet(doc, cursor, destination.name, fonts);
    }
  }

  sectionTitle(doc, cursor, "Privacidad y alcance", fonts);
  bullet(
    doc,
    cursor,
    "Este reporte no incluye nombres, teléfonos ni correos del directorio de residentes.",
    fonts,
  );
  bullet(
    doc,
    cursor,
    "La aprobación de este documento no crea por sí sola casas, residentes, guardias, destinos ni usuarios en ENTRY.",
    fonts,
  );

  sectionTitle(doc, cursor, "Control del documento", fonts);
  bullet(doc, cursor, `Versión: ${snapshot.source.versionLabel}`, fonts);
  bullet(doc, cursor, `Generado: ${formatDate(snapshot.generatedAt)}`, fonts);
  bullet(doc, cursor, `Archivo de preparación: ${snapshot.source.filename}`, fonts);
  bullet(doc, cursor, `Referencia de integridad: ${snapshot.source.sha256Prefix}`, fonts);

  const pages = doc.getPages();
  pages.forEach((page, index) => {
    page.drawLine({
      color: rgb(0.9, 0.9, 0.92),
      end: { x: PAGE_WIDTH - MARGIN, y: 38 },
      start: { x: MARGIN, y: 38 },
      thickness: 0.6,
    });
    page.drawText(
      `Minerva Technologies · ENTRY · ${snapshot.source.versionLabel} · ${index + 1}/${pages.length}`,
      {
        color: rgb(0.48, 0.5, 0.56),
        font: regular,
        size: 7.5,
        x: MARGIN,
        y: 22,
      },
    );
  });

  return Buffer.from(await doc.save());
}
