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

type Fonts = { bold: PDFFont; regular: PDFFont };
type Cursor = { page: PDFPage; y: number };

const W = 612;
const H = 792;
const M = 42;
const CW = W - M * 2;
const BOTTOM = 76;
const FOOTER_Y = 30;

const C = {
  brand: rgb(0.055, 0.075, 0.35),
  bright: rgb(0.19, 0.23, 0.9),
  soft: rgb(0.95, 0.965, 1),
  ink: rgb(0.055, 0.065, 0.13),
  muted: rgb(0.36, 0.4, 0.5),
  line: rgb(0.86, 0.88, 0.93),
  card: rgb(0.985, 0.99, 1),
  green: rgb(0.03, 0.56, 0.28),
  greenDark: rgb(0.025, 0.34, 0.17),
  greenSoft: rgb(0.91, 0.985, 0.94),
  red: rgb(0.91, 0.2, 0.31),
  redSoft: rgb(1, 0.94, 0.955),
  amber: rgb(0.69, 0.39, 0.035),
  amberDark: rgb(0.37, 0.22, 0.02),
  amberSoft: rgb(1, 0.965, 0.84),
};

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function splitWord(word: string, font: PDFFont, size: number, maxWidth: number) {
  const out: string[] = [];
  let part = "";
  for (const ch of Array.from(word)) {
    const next = part + ch;
    if (part && font.widthOfTextAtSize(next, size) > maxWidth) {
      out.push(part);
      part = ch;
    } else part = next;
  }
  if (part) out.push(part);
  return out.length ? out : [word];
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      if (current) lines.push(current);
      const parts = splitWord(word, font, size, maxWidth);
      lines.push(...parts.slice(0, -1));
      current = parts.at(-1) ?? "";
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function ellipsis(text: string, font: PDFFont, size: number, maxWidth: number) {
  const value = text.trim();
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let cut = value;
  while (cut && font.widthOfTextAtSize(`${cut}...`, size) > maxWidth) {
    cut = cut.slice(0, -1).trimEnd();
  }
  return cut ? `${cut}...` : "...";
}

function wrapped(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  color = C.ink,
  lineHeight = size * 1.35,
) {
  const lines = wrap(text, font, size, maxWidth);
  lines.forEach((line, i) => page.drawText(line, { color, font, size, x, y: y - i * lineHeight }));
  return y - lines.length * lineHeight;
}

function rightX(text: string, font: PDFFont, size: number, right: number) {
  return right - font.widthOfTextAtSize(text, size);
}

function minervaMark(page: PDFPage, x: number, y: number) {
  const t = 1.8;
  page.drawLine({ color: C.bright, start: { x, y }, end: { x: x + 8, y: y + 15 }, thickness: t });
  page.drawLine({ color: C.bright, start: { x: x + 8, y: y + 15 }, end: { x: x + 15, y }, thickness: t });
  page.drawLine({ color: C.bright, start: { x: x + 15, y: y + 15 }, end: { x: x + 23, y }, thickness: t });
  page.drawLine({ color: C.bright, start: { x: x + 15, y: y + 15 }, end: { x: x + 8, y }, thickness: t });
}

function brandHeader(page: PDFPage, f: Fonts) {
  const y = H - 43;
  page.drawText("E N T R Y", { color: C.brand, font: f.bold, size: 17, x: M, y });
  page.drawText("COMUNIDADES MÁS SEGURAS", { color: C.muted, font: f.bold, size: 5.1, x: M + 1, y: y - 12 });
  const name = "MINERVA TECHNOLOGIES";
  const size = 7.7;
  const tx = rightX(name, f.bold, size, W - M);
  minervaMark(page, tx - 34, y - 2);
  page.drawText(name, { color: C.brand, font: f.bold, size, x: tx, y: y + 2 });
  const tag = "TECNOLOGÍA CON PROPÓSITO";
  page.drawText(tag, { color: C.muted, font: f.bold, size: 4.6, x: rightX(tag, f.bold, 4.6, W - M), y: y - 9 });
}

function section(page: PDFPage, f: Fonts, text: string, y: number) {
  page.drawCircle({ color: C.soft, size: 10, x: M + 10, y: y + 5 });
  page.drawCircle({ color: C.bright, size: 2.8, x: M + 10, y: y + 5 });
  page.drawText(text, { color: C.brand, font: f.bold, size: 12.2, x: M + 29, y });
  return y - 21;
}

function divider(page: PDFPage, y: number) {
  page.drawLine({ color: C.line, start: { x: M + 29, y }, end: { x: W - M, y }, thickness: 0.65 });
}

function bullet(page: PDFPage, f: Fonts, text: string, y: number, color = C.green, x = M + 29, maxWidth = CW - 29) {
  page.drawCircle({ color, size: 2.2, x: x + 3, y: y + 3 });
  return wrapped(page, text, f.regular, 8.35, x + 13, y, maxWidth - 15, C.ink, 11.1);
}

function documentIcon(page: PDFPage, x: number, y: number, color: ReturnType<typeof rgb>) {
  page.drawRectangle({ borderColor: color, borderWidth: 1.1, height: 18, width: 14, x, y });
  page.drawLine({ color, start: { x: x + 4, y: y + 12 }, end: { x: x + 10, y: y + 12 }, thickness: 0.8 });
  page.drawLine({ color, start: { x: x + 4, y: y + 8 }, end: { x: x + 10, y: y + 8 }, thickness: 0.8 });
}

function checkIcon(page: PDFPage, x: number, y: number, color: ReturnType<typeof rgb>) {
  page.drawCircle({ borderColor: color, borderWidth: 1.5, size: 12, x, y });
  page.drawLine({ color, start: { x: x - 5, y: y + 1 }, end: { x: x - 1, y: y - 2 }, thickness: 1.7 });
  page.drawLine({ color, start: { x: x - 1, y: y - 2 }, end: { x: x + 6, y: y + 5 }, thickness: 1.7 });
}

function callout(input: {
  page: PDFPage;
  f: Fonts;
  y: number;
  fill: ReturnType<typeof rgb>;
  border: ReturnType<typeof rgb>;
  color: ReturnType<typeof rgb>;
  label: string;
  text: string;
  icon: "document" | "check";
}) {
  const h = 52;
  input.page.drawRectangle({ color: input.fill, borderColor: input.border, borderWidth: 0.8, x: M, y: input.y - h, width: CW, height: h });
  if (input.icon === "check") checkIcon(input.page, M + 26, input.y - 27, input.color);
  else documentIcon(input.page, M + 19, input.y - 36, input.color);
  input.page.drawText(input.label.toUpperCase(), { color: input.color, font: input.f.bold, size: 7.2, x: M + 57, y: input.y - 18 });
  wrapped(input.page, input.text, input.f.bold, 10.8, M + 57, input.y - 37, CW - 72, input.color, 13);
  return input.y - h;
}

function statCard(input: {
  page: PDFPage;
  f: Fonts;
  x: number;
  y: number;
  w: number;
  label: string;
  value: string;
  accent: ReturnType<typeof rgb>;
  soft: ReturnType<typeof rgb>;
}) {
  const h = 58;
  input.page.drawRectangle({ color: C.card, borderColor: C.line, borderWidth: 0.8, x: input.x, y: input.y - h, width: input.w, height: h });
  input.page.drawCircle({ color: input.soft, size: 17, x: input.x + 29, y: input.y - 29 });
  input.page.drawCircle({ color: input.accent, size: 5, x: input.x + 29, y: input.y - 29 });
  const label = ellipsis(input.label.toUpperCase(), input.f.bold, 6.6, input.w - 72);
  input.page.drawText(label, { color: C.muted, font: input.f.bold, size: 6.6, x: input.x + 57, y: input.y - 21 });
  input.page.drawText(input.value, { color: C.ink, font: input.f.bold, size: 17.5, x: input.x + 57, y: input.y - 43 });
}

function findingMessages(findings: SetupFinding[]) {
  const counts = new Map<string, number>();
  findings.filter((f) => f.severity !== "info").forEach((f) => counts.set(f.code, (counts.get(f.code) ?? 0) + 1));
  const out: string[] = [];
  for (const [code, n] of counts) {
    if (code === "COMMUNITY_NAME_MISMATCH") out.push("El nombre de la comunidad en la información preparada no coincide exactamente con el registrado en Outrider.");
    else if (code === "UNIT_REFERENCE_MISSING") out.push(`${n} ${plural(n, "unidad no tiene", "unidades no tienen")} una referencia visible para residentes.`);
    else if (code === "UNIT_TYPE_MISSING") out.push(`${n} ${plural(n, "unidad requiere", "unidades requieren")} confirmar su tipo antes de la configuración final.`);
    else if (code === "UNIT_ACTIVE_UNKNOWN") out.push(`${n} ${plural(n, "unidad requiere", "unidades requieren")} confirmar si iniciará activa o inactiva.`);
    else if (code === "RESIDENT_CONTACT_MISSING") out.push(`${n} ${plural(n, "registro de residente no tiene", "registros de residentes no tienen")} teléfono ni correo de contacto.`);
    else if (code === "RESIDENT_PROBABLE_DUPLICATE") out.push(`${n} ${plural(n, "registro podría estar duplicado", "registros podrían estar duplicados")} y Minerva debe revisarlo antes de activar usuarios.`);
    else if (code === "UNIT_HAS_NO_RESIDENT_INFORMATION") out.push(`${n} ${plural(n, "unidad que iniciará activa no tiene", "unidades que iniciarán activas no tienen")} información de residentes.`);
    else if (code === "RESIDENT_COVERAGE_PARTIAL" && !counts.has("UNIT_HAS_NO_RESIDENT_INFORMATION")) out.push("La información de residentes todavía no cubre todas las unidades que iniciarán activas.");
    else if (code !== "RESIDENT_COVERAGE_PARTIAL") out.push(`${n} ${plural(n, "observación adicional requiere", "observaciones adicionales requieren")} revisión interna de Minerva antes de continuar.`);
  }
  return out;
}

function statusLabel(value: boolean | null) {
  if (value === true) return "Activa al inicio";
  if (value === false) return "Inactiva al inicio";
  return "Estado por confirmar";
}

function statusColor(value: boolean | null) {
  if (value === true) return C.green;
  if (value === false) return C.red;
  return C.amber;
}

function detailPage(doc: PdfDocumentType, f: Fonts, continued = false): Cursor {
  const page = doc.addPage([W, H]);
  brandHeader(page, f);
  page.drawText(continued ? "Detalle para confirmación · continuación" : "Detalle para confirmación", {
    color: C.ink,
    font: f.bold,
    size: continued ? 16 : 20,
    x: M,
    y: H - 92,
  });
  if (!continued) {
    wrapped(page, "Revise este listado para confirmar que las unidades y su estado inicial coinciden con lo esperado antes de la activación.", f.regular, 8.8, M, H - 114, CW, C.muted, 12.5);
    return { page, y: H - 151 };
  }
  return { page, y: H - 123 };
}

function summaryContinuation(doc: PdfDocumentType, f: Fonts): Cursor {
  const page = doc.addPage([W, H]);
  brandHeader(page, f);
  page.drawText("Resumen preliminar de preparación · continuación", { color: C.ink, font: f.bold, size: 16, x: M, y: H - 92 });
  return { page, y: H - 123 };
}

function unitRowHeight(label: string, f: Fonts) {
  return Math.max(18, wrap(label, f.regular, 8.9, CW - 190).length * 10.8 + 6);
}

function unitRow(page: PDFPage, f: Fonts, y: number, label: string, active: boolean | null) {
  const labelX = M + 32;
  const statusX = W - M - 118;
  const lines = wrap(label, f.regular, 8.9, statusX - labelX - 16);
  const h = Math.max(18, lines.length * 10.8 + 6);
  page.drawLine({ color: rgb(0.91, 0.92, 0.95), start: { x: M + 12, y: y - h + 4 }, end: { x: W - M - 12, y: y - h + 4 }, thickness: 0.5 });
  page.drawCircle({ color: statusColor(active), size: 2.8, x: M + 20, y: y + 2 });
  lines.forEach((line, i) => page.drawText(line, { color: C.ink, font: f.regular, size: 8.9, x: labelX, y: y - i * 10.8 }));
  page.drawText(statusLabel(active), { color: C.muted, font: f.regular, size: 8.5, x: statusX, y });
  return y - h;
}

function footer(page: PDFPage, f: Fonts, s: OutriderSetupReportSnapshot, index: number, total: number) {
  page.drawLine({ color: C.line, start: { x: M, y: FOOTER_Y + 11 }, end: { x: W - M, y: FOOTER_Y + 11 }, thickness: 0.6 });
  const size = 6.5;
  const right = `Versión ${s.source.versionLabel} · ${formatDate(s.generatedAt)} · ${index + 1}/${total}`;
  const rightText = ellipsis(right, f.regular, size, CW * 0.45);
  const rx = rightX(rightText, f.regular, size, W - M);
  const left = ellipsis(`${s.intake.communityName.toUpperCase()}${s.intake.communityCity ? `  |  ${s.intake.communityCity.toUpperCase()}` : ""}`, f.regular, size, Math.max(80, rx - M - 14));
  page.drawText(left, { color: C.muted, font: f.regular, size, x: M, y: FOOTER_Y - 1 });
  page.drawText(rightText, { color: C.muted, font: f.regular, size, x: rx, y: FOOTER_Y - 1 });
}

export async function renderSetupReportPdf(snapshot: OutriderSetupReportSnapshot) {
  const doc = await PDFDocument.create();
  const f: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const active = snapshot.workbook.units.filter((u) => u.isActive === true).length;
  const inactive = snapshot.workbook.units.filter((u) => u.isActive === false).length;
  const unknown = snapshot.workbook.units.filter((u) => u.isActive === null).length;
  const launchUnits = new Set(snapshot.workbook.units.filter((u) => u.isActive !== false).map((u) => normalizeSetupUnitIdentity(u.unitLabel)).filter((u): u is string => Boolean(u)));
  const coveredUnits = new Set(snapshot.workbook.residents.map((r) => normalizeSetupUnitIdentity(r.unitLabel)).filter((u): u is string => Boolean(u) && launchUnits.has(u))).size;
  const findings = findingMessages(snapshot.validation.findings);
  const ready = snapshot.summary.residentCoveragePercent === 100 && findings.length === 0 && unknown === 0;

  const page = doc.addPage([W, H]);
  brandHeader(page, f);
  let y = H - 88;
  page.drawText("Resumen preliminar de preparación", { color: C.ink, font: f.bold, size: 20, x: M, y });
  y -= 22;
  const community = wrap(snapshot.intake.communityName, f.regular, 12.4, CW).slice(0, 2);
  community.forEach((line, i) => page.drawText(line, { color: C.brand, font: f.regular, size: 12.4, x: M, y: y - i * 14.5 }));
  y -= community.length * 14.5;
  if (snapshot.intake.communityCity) {
    page.drawCircle({ color: C.brand, size: 2.1, x: M + 2, y: y + 2.4 });
    page.drawText(ellipsis(snapshot.intake.communityCity, f.regular, 8.5, CW - 10), { color: C.muted, font: f.regular, size: 8.5, x: M + 10, y });
    y -= 12;
  }
  y -= 6;

  callout({ page, f, y, fill: C.amberSoft, border: rgb(0.94, 0.81, 0.42), color: C.amberDark, label: "Documento preliminar", text: "Todavía no se ha aplicado ningún cambio operativo a ENTRY.", icon: "document" });
  y -= 60;
  callout({ page, f, y, fill: ready ? C.greenSoft : C.amberSoft, border: ready ? rgb(0.6, 0.86, 0.68) : rgb(0.94, 0.81, 0.42), color: ready ? C.greenDark : C.amberDark, label: "Estado de preparación", text: ready ? "Lista para revisión final" : "Con observaciones por revisar", icon: ready ? "check" : "document" });
  y -= 61;
  y = wrapped(page, "Este documento resume la información que Minerva organizó para preparar ENTRY y permite confirmar, de forma sencilla, qué está listo y qué falta revisar antes de la activación.", f.regular, 8.7, M, y, CW, C.muted, 12.2) - 7;

  y = section(page, f, "Resumen de la comunidad", y);
  const gap = 10;
  const cardW = (CW - gap) / 2;
  statCard({ page, f, x: M, y, w: cardW, label: "Unidades identificadas", value: String(snapshot.summary.units), accent: C.bright, soft: C.soft });
  statCard({ page, f, x: M + cardW + gap, y, w: cardW, label: "Activas al inicio", value: String(active), accent: C.green, soft: C.greenSoft });
  y -= 66;
  statCard({ page, f, x: M, y, w: cardW, label: "Inactivas al inicio", value: String(inactive), accent: C.red, soft: C.redSoft });
  statCard({ page, f, x: M + cardW + gap, y, w: cardW, label: "Cobertura de unidades activas", value: snapshot.summary.residentCoveragePercent === null ? "Pendiente" : `${snapshot.summary.residentCoveragePercent}%`, accent: C.bright, soft: C.soft });
  y -= 64;
  y = wrapped(page, `La cobertura considera las ${launchUnits.size} ${plural(launchUnits.size, "unidad que iniciará activa o requiere confirmar estado", "unidades que iniciarán activas o requieren confirmar estado")}. Las unidades marcadas expresamente como inactivas no se cuentan como faltantes de residentes.`, f.regular, 7.2, M, y, CW, C.muted, 10) - 8;

  y = section(page, f, "Información preparada", y);
  y = bullet(page, f, `${snapshot.summary.residentRows} ${plural(snapshot.summary.residentRows, "registro de residente recibido", "registros de residentes recibidos")} para ${coveredUnits} ${plural(coveredUnits, "unidad de inicio", "unidades de inicio")}.`, y) - 2;
  y = bullet(page, f, `${snapshot.summary.destinationRows} ${plural(snapshot.summary.destinationRows, "establecimiento o destino identificado", "establecimientos o destinos identificados")}.`, y) - 2;
  y = bullet(page, f, `${snapshot.summary.adminRows} ${plural(snapshot.summary.adminRows, "administrador inicial preparado", "administradores iniciales preparados")}.`, y) - 2;
  y = bullet(page, f, `Personal de seguridad informado: ${snapshot.intake.securityStaffCount ?? "pendiente de confirmar"}.`, y) - 1;
  divider(page, y);
  y -= 18;

  y = section(page, f, "Observaciones antes de activar", y);
  if (!findings.length) {
    y = bullet(page, f, "No se identifican pendientes que impidan continuar con la revisión final.", y) - 2;
    if (inactive) y = bullet(page, f, `${inactive} ${plural(inactive, "unidad está marcada como inactiva", "unidades están marcadas como inactivas")} y no requiere residente para el cálculo de cobertura inicial.`, y) - 2;
  } else {
    for (const message of findings.slice(0, 4)) y = bullet(page, f, message, y, C.amber) - 2;
  }
  divider(page, y);
  y -= 18;

  const next = ready
    ? "Una vez confirmada esta información, Minerva incorporará la residencial a ENTRY y dará inicio a la fase de registro de residentes. Si se requiere algún ajuste de nomenclatura o detalle operativo, podrá afinarse antes de la activación."
    : snapshot.recommendation;
  const nextHeight = 27 + wrap(next, f.regular, 8.6, CW - 29).length * 11.2;
  let nextCursor: Cursor = { page, y };
  if (y - nextHeight < BOTTOM) nextCursor = summaryContinuation(doc, f);
  nextCursor.y = section(nextCursor.page, f, "Siguiente paso", nextCursor.y);
  wrapped(nextCursor.page, next, f.regular, 8.6, M + 29, nextCursor.y, CW - 29, C.muted, 11.2);

  let d = detailPage(doc, f);
  d.y = section(d.page, f, "Listado de unidades", d.y);
  const listHeight = snapshot.workbook.units.reduce((sum, u) => sum + unitRowHeight(u.publicReference ?? u.unitLabel ?? "Unidad sin referencia", f), 0) + 10;
  if (d.y - listHeight >= BOTTOM) {
    d.page.drawRectangle({ color: C.card, borderColor: C.line, borderWidth: 0.8, x: M, y: d.y - listHeight + 7, width: CW, height: listHeight });
    d.y -= 7;
  }

  for (const unit of snapshot.workbook.units) {
    const label = unit.publicReference ?? unit.unitLabel ?? "Unidad sin referencia";
    const h = unitRowHeight(label, f);
    if (d.y - h < BOTTOM) {
      d = detailPage(doc, f, true);
      d.y = section(d.page, f, "Listado de unidades · continuación", d.y);
    }
    d.y = unitRow(d.page, f, d.y, label, unit.isActive);
  }

  const need = (height: number) => {
    if (d.y - height >= BOTTOM) return false;
    d = detailPage(doc, f, true);
    return true;
  };

  if (snapshot.workbook.destinations.length) {
    const title = "Establecimientos y destinos informados";
    if (!need(65)) d.y -= 9;
    d.y = section(d.page, f, title, d.y);
    for (const destination of snapshot.workbook.destinations) {
      if (!destination.name) continue;
      const h = wrap(destination.name, f.regular, 8.35, CW - 44).length * 11.1 + 4;
      if (need(h + 24)) d.y = section(d.page, f, `${title} · continuación`, d.y);
      d.y = bullet(d.page, f, destination.name, d.y) - 2;
    }
  }

  const privacy = [
    "Este reporte no incluye nombres, teléfonos ni correos del directorio de residentes.",
    "La aprobación de este documento no crea por sí sola casas, residentes, guardias, destinos ni usuarios en ENTRY.",
  ];
  const privacyH = 30 + privacy.reduce((sum, t) => sum + wrap(t, f.regular, 8.35, CW - 44).length * 11.1 + 2, 0);
  if (!need(privacyH)) {
    d.y -= 7;
    divider(d.page, d.y + 8);
    d.y -= 10;
  }
  d.y = section(d.page, f, "Privacidad y alcance", d.y);
  for (const text of privacy) d.y = bullet(d.page, f, text, d.y) - 2;

  const control = [
    `Versión: ${snapshot.source.versionLabel}`,
    `Generado: ${formatDate(snapshot.generatedAt)}`,
    "Fuente de preparación: información validada por Minerva",
    `Referencia de integridad: ${snapshot.source.sha256Prefix}`,
  ];
  const controlH = 30 + control.reduce((sum, t) => sum + wrap(t, f.regular, 8.35, CW - 44).length * 11.1 + 2, 0);
  if (!need(controlH)) {
    d.y -= 7;
    divider(d.page, d.y + 8);
    d.y -= 10;
  }
  d.y = section(d.page, f, "Control del documento", d.y);
  control.forEach((text, i) => {
    d.y = bullet(d.page, f, text, d.y) - (i === control.length - 1 ? 0 : 2);
  });

  const pages = doc.getPages();
  pages.forEach((p, i) => footer(p, f, snapshot, i, pages.length));
  return Buffer.from(await doc.save());
}
