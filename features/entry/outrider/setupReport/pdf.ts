import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFDocument as PdfDocumentType,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type {
  OutriderSetupReportSnapshot,
  SetupFinding,
} from "@/features/entry/outrider/setupReport/model";
import { normalizeSetupUnitIdentity } from "@/features/entry/outrider/setupReport/normalization";

type Fonts = {
  bold: PDFFont;
  regular: PDFFont;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = 34;

const COLORS = {
  brand: rgb(0.08, 0.1, 0.42),
  brandSoft: rgb(0.95, 0.96, 1),
  ink: rgb(0.08, 0.09, 0.16),
  muted: rgb(0.39, 0.43, 0.52),
  border: rgb(0.86, 0.88, 0.93),
  card: rgb(0.98, 0.985, 0.995),
  green: rgb(0.05, 0.54, 0.3),
  greenDark: rgb(0.04, 0.34, 0.19),
  greenSoft: rgb(0.9, 0.98, 0.93),
  red: rgb(0.9, 0.18, 0.3),
  redSoft: rgb(1, 0.93, 0.95),
  amber: rgb(0.7, 0.42, 0.04),
  amberDark: rgb(0.38, 0.24, 0.03),
  amberSoft: rgb(1, 0.96, 0.82),
  white: rgb(1, 1, 1),
};

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

function drawWrappedText(
  page: PDFPage,
  text: string,
  options: {
    color?: ReturnType<typeof rgb>;
    font: PDFFont;
    lineHeight?: number;
    maxWidth: number;
    size: number;
    x: number;
    y: number;
  },
) {
  const lineHeight = options.lineHeight ?? options.size * 1.35;
  const lines = wrapText(text, options.font, options.size, options.maxWidth);

  lines.forEach((line, index) => {
    page.drawText(line, {
      color: options.color ?? COLORS.ink,
      font: options.font,
      size: options.size,
      x: options.x,
      y: options.y - index * lineHeight,
    });
  });

  return options.y - lines.length * lineHeight;
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

function rightAlignedX(text: string, font: PDFFont, size: number, right: number) {
  return right - font.widthOfTextAtSize(text, size);
}

function drawBrandHeader(page: PDFPage, fonts: Fonts) {
  page.drawText("E N T R Y", {
    color: COLORS.brand,
    font: fonts.bold,
    size: 17,
    x: MARGIN,
    y: PAGE_HEIGHT - 48,
  });
  page.drawText("MINERVA TECHNOLOGIES", {
    color: COLORS.brand,
    font: fonts.bold,
    size: 8.5,
    x: rightAlignedX(
      "MINERVA TECHNOLOGIES",
      fonts.bold,
      8.5,
      PAGE_WIDTH - MARGIN,
    ),
    y: PAGE_HEIGHT - 44,
  });
  page.drawLine({
    color: rgb(0.92, 0.93, 0.96),
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 64 },
    start: { x: MARGIN, y: PAGE_HEIGHT - 64 },
    thickness: 0.7,
  });
}

function drawSectionTitle(
  page: PDFPage,
  text: string,
  fonts: Fonts,
  y: number,
) {
  page.drawCircle({
    color: COLORS.brandSoft,
    size: 9,
    x: MARGIN + 9,
    y: y + 5,
  });
  page.drawCircle({
    color: COLORS.brand,
    size: 2.4,
    x: MARGIN + 9,
    y: y + 5,
  });
  page.drawText(text, {
    color: COLORS.brand,
    font: fonts.bold,
    size: 12.5,
    x: MARGIN + 26,
    y,
  });
  return y - 21;
}

function drawStatCard(input: {
  accent: ReturnType<typeof rgb>;
  fonts: Fonts;
  label: string;
  page: PDFPage;
  value: string;
  width: number;
  x: number;
  y: number;
}) {
  const height = 52;
  input.page.drawRectangle({
    borderColor: COLORS.border,
    borderWidth: 0.8,
    color: COLORS.card,
    height,
    width: input.width,
    x: input.x,
    y: input.y - height,
  });
  input.page.drawRectangle({
    color: input.accent,
    height: 30,
    width: 3,
    x: input.x + 10,
    y: input.y - 41,
  });
  input.page.drawText(input.label.toUpperCase(), {
    color: COLORS.muted,
    font: input.fonts.bold,
    size: 6.7,
    x: input.x + 20,
    y: input.y - 18,
  });
  input.page.drawText(input.value, {
    color: COLORS.ink,
    font: input.fonts.bold,
    size: 17,
    x: input.x + 20,
    y: input.y - 40,
  });
}

function drawBulletLine(input: {
  color?: ReturnType<typeof rgb>;
  fonts: Fonts;
  maxWidth: number;
  page: PDFPage;
  text: string;
  x: number;
  y: number;
}) {
  input.page.drawCircle({
    color: input.color ?? COLORS.green,
    size: 2.2,
    x: input.x + 3,
    y: input.y + 3,
  });
  return drawWrappedText(input.page, input.text, {
    color: COLORS.ink,
    font: input.fonts.regular,
    lineHeight: 12,
    maxWidth: input.maxWidth - 14,
    size: 8.7,
    x: input.x + 13,
    y: input.y,
  });
}

function drawCallout(input: {
  border: ReturnType<typeof rgb>;
  fill: ReturnType<typeof rgb>;
  fonts: Fonts;
  label: string;
  labelColor: ReturnType<typeof rgb>;
  page: PDFPage;
  text: string;
  textColor?: ReturnType<typeof rgb>;
  y: number;
}) {
  const height = 52;
  input.page.drawRectangle({
    borderColor: input.border,
    borderWidth: 0.8,
    color: input.fill,
    height,
    width: CONTENT_WIDTH,
    x: MARGIN,
    y: input.y - height,
  });
  input.page.drawText(input.label.toUpperCase(), {
    color: input.labelColor,
    font: input.fonts.bold,
    size: 7.5,
    x: MARGIN + 14,
    y: input.y - 17,
  });
  drawWrappedText(input.page, input.text, {
    color: input.textColor ?? input.labelColor,
    font: input.fonts.bold,
    lineHeight: 14,
    maxWidth: CONTENT_WIDTH - 28,
    size: 11.5,
    x: MARGIN + 14,
    y: input.y - 37,
  });
  return input.y - height;
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
          "El nombre de la comunidad en la información preparada no coincide exactamente con el registrado en Outrider.",
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
          `${count} ${plural(count, "observación adicional requiere", "observaciones adicionales requieren")} revisión interna de Minerva antes de continuar.`,
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

function unitStatusColor(value: boolean | null) {
  if (value === true) return COLORS.green;
  if (value === false) return COLORS.red;
  return COLORS.amber;
}

function drawDetailHeading(page: PDFPage, fonts: Fonts, continued = false) {
  drawBrandHeader(page, fonts);
  page.drawText(
    continued ? "Detalle para confirmación · continuación" : "Detalle para confirmación",
    {
      color: COLORS.ink,
      font: fonts.bold,
      size: continued ? 16 : 20,
      x: MARGIN,
      y: PAGE_HEIGHT - 99,
    },
  );

  if (!continued) {
    drawWrappedText(
      page,
      "Revise este listado para confirmar que las unidades y su estado inicial coinciden con lo esperado antes de la activación.",
      {
        color: COLORS.muted,
        font: fonts.regular,
        lineHeight: 13,
        maxWidth: CONTENT_WIDTH,
        size: 9,
        x: MARGIN,
        y: PAGE_HEIGHT - 119,
      },
    );
    return PAGE_HEIGHT - 154;
  }

  return PAGE_HEIGHT - 127;
}

function addDetailPage(
  doc: PdfDocumentType,
  fonts: Fonts,
  continued = false,
) {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const y = drawDetailHeading(page, fonts, continued);
  return { page, y };
}

function drawUnitRow(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  label: string,
  status: string,
  statusColor: ReturnType<typeof rgb>,
) {
  page.drawLine({
    color: rgb(0.91, 0.92, 0.95),
    end: { x: PAGE_WIDTH - MARGIN, y: y - 8 },
    start: { x: MARGIN + 18, y: y - 8 },
    thickness: 0.55,
  });
  page.drawCircle({
    color: statusColor,
    size: 2.8,
    x: MARGIN + 6,
    y: y + 2,
  });
  page.drawText(label, {
    color: COLORS.ink,
    font: fonts.regular,
    size: 9.2,
    x: MARGIN + 18,
    y,
  });
  page.drawText(status, {
    color: COLORS.muted,
    font: fonts.regular,
    size: 8.8,
    x: PAGE_WIDTH - MARGIN - 116,
    y,
  });
  return y - 19;
}

function drawFooter(
  page: PDFPage,
  fonts: Fonts,
  snapshot: OutriderSetupReportSnapshot,
  index: number,
  total: number,
) {
  page.drawLine({
    color: rgb(0.9, 0.91, 0.94),
    end: { x: PAGE_WIDTH - MARGIN, y: FOOTER_Y + 10 },
    start: { x: MARGIN, y: FOOTER_Y + 10 },
    thickness: 0.6,
  });
  const left = `${snapshot.intake.communityName.toUpperCase()}${
    snapshot.intake.communityCity ? `  ·  ${snapshot.intake.communityCity.toUpperCase()}` : ""
  }`;
  page.drawText(left, {
    color: COLORS.muted,
    font: fonts.regular,
    size: 6.8,
    x: MARGIN,
    y: FOOTER_Y - 2,
  });
  const right = `${snapshot.source.versionLabel} · ${formatDate(snapshot.generatedAt)} · ${index + 1}/${total}`;
  page.drawText(right, {
    color: COLORS.muted,
    font: fonts.regular,
    size: 6.8,
    x: rightAlignedX(right, fonts.regular, 6.8, PAGE_WIDTH - MARGIN),
    y: FOOTER_Y - 2,
  });
}

export async function renderSetupReportPdf(
  snapshot: OutriderSetupReportSnapshot,
) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { bold, regular };

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

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawBrandHeader(page, fonts);

  let y = PAGE_HEIGHT - 99;
  page.drawText("Resumen preliminar de preparación", {
    color: COLORS.ink,
    font: bold,
    size: 20,
    x: MARGIN,
    y,
  });
  y -= 20;
  page.drawText(snapshot.intake.communityName, {
    color: COLORS.brand,
    font: regular,
    size: 12.5,
    x: MARGIN,
    y,
  });
  y -= 16;
  if (snapshot.intake.communityCity) {
    page.drawText(snapshot.intake.communityCity, {
      color: COLORS.muted,
      font: regular,
      size: 8.5,
      x: MARGIN,
      y,
    });
    y -= 12;
  }
  y -= 8;

  drawCallout({
    border: rgb(0.94, 0.81, 0.42),
    fill: COLORS.amberSoft,
    fonts,
    label: "Documento preliminar",
    labelColor: COLORS.amberDark,
    page,
    text: "Todavía no se ha aplicado ningún cambio operativo a ENTRY.",
    y,
  });
  y -= 62;

  drawCallout({
    border: readyForFinalReview ? rgb(0.61, 0.85, 0.68) : rgb(0.94, 0.81, 0.42),
    fill: readyForFinalReview ? COLORS.greenSoft : COLORS.amberSoft,
    fonts,
    label: "Estado de preparación",
    labelColor: readyForFinalReview ? COLORS.greenDark : COLORS.amberDark,
    page,
    text: readyForFinalReview
      ? "Lista para revisión final"
      : "Con observaciones por revisar",
    y,
  });
  y -= 64;

  y = drawWrappedText(
    page,
    "Este documento resume la información que Minerva organizó para preparar ENTRY y permite confirmar, de forma sencilla, qué está listo y qué falta revisar antes de la activación.",
    {
      color: COLORS.muted,
      font: regular,
      lineHeight: 13,
      maxWidth: CONTENT_WIDTH,
      size: 9,
      x: MARGIN,
      y,
    },
  );
  y -= 8;

  y = drawSectionTitle(page, "Resumen de la comunidad", fonts, y);
  const gap = 8;
  const cardWidth = (CONTENT_WIDTH - gap * 2) / 3;
  const rowOne = y;
  drawStatCard({ accent: COLORS.brand, fonts, label: "Unidades identificadas", page, value: String(snapshot.summary.units), width: cardWidth, x: MARGIN, y: rowOne });
  drawStatCard({ accent: COLORS.green, fonts, label: "Activas al inicio", page, value: String(activeUnits), width: cardWidth, x: MARGIN + cardWidth + gap, y: rowOne });
  drawStatCard({ accent: COLORS.red, fonts, label: "Inactivas al inicio", page, value: String(inactiveUnits), width: cardWidth, x: MARGIN + (cardWidth + gap) * 2, y: rowOne });

  const rowTwo = rowOne - 60;
  drawStatCard({
    accent: COLORS.brand,
    fonts,
    label: "Cobertura unidades activas",
    page,
    value:
      snapshot.summary.residentCoveragePercent === null
        ? "Pendiente"
        : `${snapshot.summary.residentCoveragePercent}%`,
    width: cardWidth,
    x: MARGIN,
    y: rowTwo,
  });
  drawStatCard({ accent: COLORS.brand, fonts, label: "Establecimientos / destinos", page, value: String(snapshot.summary.destinationRows), width: cardWidth, x: MARGIN + cardWidth + gap, y: rowTwo });
  drawStatCard({ accent: COLORS.brand, fonts, label: "Personal de seguridad", page, value: String(snapshot.intake.securityStaffCount ?? "—"), width: cardWidth, x: MARGIN + (cardWidth + gap) * 2, y: rowTwo });
  y = rowTwo - 62;

  y = drawWrappedText(
    page,
    `La cobertura considera las ${populationUnits.size} ${plural(
      populationUnits.size,
      "unidad que iniciará activa o requiere confirmar estado",
      "unidades que iniciarán activas o requieren confirmar estado",
    )}. Las unidades marcadas expresamente como inactivas no se cuentan como faltantes de residentes.`,
    {
      color: COLORS.muted,
      font: regular,
      lineHeight: 10.5,
      maxWidth: CONTENT_WIDTH,
      size: 7.4,
      x: MARGIN,
      y,
    },
  );
  y -= 9;

  const columnGap = 22;
  const columnWidth = (CONTENT_WIDTH - columnGap) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + columnWidth + columnGap;
  const sectionTop = y;

  page.drawText("Información preparada", {
    color: COLORS.brand,
    font: bold,
    size: 11.5,
    x: leftX,
    y: sectionTop,
  });
  let leftY = sectionTop - 18;
  leftY = drawBulletLine({ fonts, maxWidth: columnWidth, page, text: `${snapshot.summary.residentRows} ${plural(snapshot.summary.residentRows, "registro de residente recibido", "registros de residentes recibidos")} para ${populatedPopulationUnits} ${plural(populatedPopulationUnits, "unidad de inicio", "unidades de inicio")}.`, x: leftX, y: leftY }) - 2;
  leftY = drawBulletLine({ fonts, maxWidth: columnWidth, page, text: `${snapshot.summary.destinationRows} ${plural(snapshot.summary.destinationRows, "establecimiento o destino identificado", "establecimientos o destinos identificados")}.`, x: leftX, y: leftY }) - 2;
  leftY = drawBulletLine({ fonts, maxWidth: columnWidth, page, text: `${snapshot.summary.adminRows} ${plural(snapshot.summary.adminRows, "administrador inicial preparado", "administradores iniciales preparados")}.`, x: leftX, y: leftY }) - 2;

  page.drawText("Observaciones antes de activar", {
    color: COLORS.brand,
    font: bold,
    size: 11.5,
    x: rightX,
    y: sectionTop,
  });
  let rightY = sectionTop - 18;
  if (customerFindings.length === 0) {
    rightY = drawBulletLine({ fonts, maxWidth: columnWidth, page, text: "No se identifican pendientes que impidan continuar con la revisión final.", x: rightX, y: rightY }) - 2;
    if (inactiveUnits > 0) {
      rightY = drawBulletLine({ fonts, maxWidth: columnWidth, page, text: `${inactiveUnits} ${plural(inactiveUnits, "unidad está marcada como inactiva", "unidades están marcadas como inactivas")} y no requiere residente para el cálculo de cobertura inicial.`, x: rightX, y: rightY }) - 2;
    }
  } else {
    for (const message of customerFindings.slice(0, 4)) {
      rightY = drawBulletLine({ color: COLORS.amber, fonts, maxWidth: columnWidth, page, text: message, x: rightX, y: rightY }) - 2;
    }
  }

  y = Math.min(leftY, rightY) - 8;
  const nextStep = readyForFinalReview
    ? "Una vez confirmada esta información, Minerva incorporará la comunidad a ENTRY y dará inicio a la fase de registro de residentes. Cualquier ajuste identificado podrá corregirse antes de la activación."
    : snapshot.recommendation;
  const nextStepLines = wrapText(nextStep, regular, 8.8, CONTENT_WIDTH - 28);
  const nextHeight = Math.max(58, 47 + (nextStepLines.length - 1) * 12);

  page.drawRectangle({
    borderColor: rgb(0.83, 0.84, 0.98),
    borderWidth: 0.8,
    color: COLORS.brandSoft,
    height: nextHeight,
    width: CONTENT_WIDTH,
    x: MARGIN,
    y: y - nextHeight,
  });
  page.drawText("SIGUIENTE PASO", {
    color: COLORS.brand,
    font: bold,
    size: 8,
    x: MARGIN + 14,
    y: y - 18,
  });
  drawWrappedText(page, nextStep, {
    color: COLORS.ink,
    font: regular,
    lineHeight: 12,
    maxWidth: CONTENT_WIDTH - 28,
    size: 8.8,
    x: MARGIN + 14,
    y: y - 35,
  });

  let detail = addDetailPage(doc, fonts);
  let detailPage = detail.page;
  let detailY = drawSectionTitle(detailPage, "Listado de unidades", fonts, detail.y);

  for (const unit of snapshot.workbook.units) {
    if (detailY < 92) {
      detail = addDetailPage(doc, fonts, true);
      detailPage = detail.page;
      detailY = drawSectionTitle(
        detailPage,
        "Listado de unidades · continuación",
        fonts,
        detail.y,
      );
    }

    const label = unit.publicReference ?? unit.unitLabel ?? "Unidad sin referencia";
    detailY = drawUnitRow(
      detailPage,
      fonts,
      detailY,
      label,
      unitStatusLabel(unit.isActive),
      unitStatusColor(unit.isActive),
    );
  }

  const ensureDetailSpace = (height: number) => {
    if (detailY - height >= 82) return false;
    detail = addDetailPage(doc, fonts, true);
    detailPage = detail.page;
    detailY = detail.y;
    return true;
  };

  if (snapshot.workbook.destinations.length > 0) {
    const destinationTitle = "Establecimientos y destinos informados";
    const movedToNewPage = ensureDetailSpace(70);
    if (!movedToNewPage) detailY -= 6;
    detailY = drawSectionTitle(detailPage, destinationTitle, fonts, detailY);

    for (const destination of snapshot.workbook.destinations) {
      if (!destination.name) continue;
      const destinationRowHeight =
        wrapText(destination.name, regular, 8.7, CONTENT_WIDTH - 14).length * 12 + 2;
      if (ensureDetailSpace(destinationRowHeight)) {
        detailY = drawSectionTitle(
          detailPage,
          `${destinationTitle} · continuación`,
          fonts,
          detailY,
        );
      }
      detailY = drawBulletLine({
        fonts,
        maxWidth: CONTENT_WIDTH,
        page: detailPage,
        text: destination.name,
        x: MARGIN,
        y: detailY,
      }) - 2;
    }
  }

  const adminNames = snapshot.workbook.admins
    .map((admin) => admin.fullName)
    .filter((name): name is string => Boolean(name));
  if (adminNames.length > 0) {
    const adminTitle =
      adminNames.length === 1
        ? "Administrador inicial propuesto"
        : "Administradores iniciales propuestos";
    const movedToNewPage = ensureDetailSpace(64);
    if (!movedToNewPage) detailY -= 4;
    detailY = drawSectionTitle(detailPage, adminTitle, fonts, detailY);

    for (const name of adminNames) {
      const adminRowHeight =
        wrapText(name, regular, 8.7, CONTENT_WIDTH - 14).length * 12 + 2;
      if (ensureDetailSpace(adminRowHeight)) {
        detailY = drawSectionTitle(
          detailPage,
          `${adminTitle} · continuación`,
          fonts,
          detailY,
        );
      }
      detailY = drawBulletLine({
        fonts,
        maxWidth: CONTENT_WIDTH,
        page: detailPage,
        text: name,
        x: MARGIN,
        y: detailY,
      }) - 2;
    }
  }

  const privacyItems = [
    "Este reporte no incluye nombres, teléfonos ni correos del directorio de residentes.",
    "La aprobación de este documento no crea por sí sola casas, residentes, guardias, destinos ni usuarios en ENTRY.",
  ];
  const privacyHeight =
    26 +
    privacyItems.reduce(
      (height, text) =>
        height + wrapText(text, regular, 8.7, CONTENT_WIDTH - 14).length * 12 + 2,
      0,
    );
  const privacyMovedToNewPage = ensureDetailSpace(privacyHeight);
  if (!privacyMovedToNewPage) detailY -= 5;
  detailY = drawSectionTitle(detailPage, "Privacidad y alcance", fonts, detailY);
  for (const text of privacyItems) {
    detailY = drawBulletLine({
      fonts,
      maxWidth: CONTENT_WIDTH,
      page: detailPage,
      text,
      x: MARGIN,
      y: detailY,
    }) - 2;
  }

  const controlItems = [
    `Versión: ${snapshot.source.versionLabel}`,
    `Generado: ${formatDate(snapshot.generatedAt)}`,
    "Fuente de preparación: información validada por Minerva",
    `Referencia de integridad: ${snapshot.source.sha256Prefix}`,
  ];
  const controlHeight =
    26 +
    controlItems.reduce(
      (height, text) =>
        height + wrapText(text, regular, 8.7, CONTENT_WIDTH - 14).length * 12 + 2,
      0,
    );
  const controlMovedToNewPage = ensureDetailSpace(controlHeight);
  if (!controlMovedToNewPage) detailY -= 5;
  detailY = drawSectionTitle(detailPage, "Control del documento", fonts, detailY);
  controlItems.forEach((text, index) => {
    const nextY = drawBulletLine({
      fonts,
      maxWidth: CONTENT_WIDTH,
      page: detailPage,
      text,
      x: MARGIN,
      y: detailY,
    });
    detailY = index === controlItems.length - 1 ? nextY : nextY - 2;
  });

  const pages = doc.getPages();
  pages.forEach((outputPage, index) => {
    drawFooter(outputPage, fonts, snapshot, index, pages.length);
  });

  return Buffer.from(await doc.save());
}
