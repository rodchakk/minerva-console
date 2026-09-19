"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  House,
  MapPin,
  Mail,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { RegistrationMissingField } from "@/features/entry/communityRegistration/review/completeness";
import type {
  CommunityRegistrationConfirmationReport,
  CommunityRegistrationConfirmationReportResident,
} from "@/features/entry/communityRegistration/review/queries";

type ConfirmationReportDrawerProps = {
  mode: "single" | "selection";
  onClose: () => void;
  report: CommunityRegistrationConfirmationReport;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-HN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function reportFilename(
  report: CommunityRegistrationConfirmationReport,
  extension: "png" | "pdf",
) {
  const date = new Date(report.generatedAt).toISOString().slice(0, 10);
  const community = safeFilename(report.communityName) || "comunidad";
  return `entry-confirmacion-${community}-${date}.${extension}`;
}

function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function residentStatus(resident: CommunityRegistrationConfirmationReportResident) {
  if (resident.missingFields.length === 0) {
    return {
      complete: true,
      label: "Completo",
    };
  }

  if (resident.missingFields.length === 1) {
    return {
      complete: false,
      label: reportMissingFieldMessage(resident.missingFields[0]),
    };
  }

  return {
    complete: false,
    label: `${resident.missingFields.length} datos pendientes`,
  };
}

function reportMissingFieldMessage(field: RegistrationMissingField) {
  switch (field.message) {
    case "Valid name missing":
      return "Falta nombre válido";
    case "Invalid email address":
      return "Correo electrónico inválido";
    case "Email missing":
      return "Falta correo electrónico";
    case "Phone missing":
      return "Falta teléfono";
    case "Unit reference missing":
      return "Falta referencia de la vivienda";
    default:
      return field.message;
  }
}

async function renderNodeToPng(node: HTMLElement) {
  if ("fonts" in document) {
    await document.fonts.ready;
  }

  const { toPng } = await import("html-to-image");

  return toPng(node, {
    backgroundColor: "#0b0e14",
    cacheBust: true,
    pixelRatio: 2,
  });
}

function ReportDocument({
  report,
}: {
  report: CommunityRegistrationConfirmationReport;
}) {
  return (
    <article className="relative w-[900px] overflow-hidden bg-[#061126] px-8 py-8 text-[#f7f8ff]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_86%_7%,rgba(124,58,237,0.32),transparent_31%),linear-gradient(160deg,#061a34_0%,#061126_44%,#030714_100%)]" />
      <div className="pointer-events-none absolute -right-10 -top-24 h-[430px] w-[210px] rotate-[34deg] rounded-full bg-[linear-gradient(180deg,rgba(124,58,237,0.92),rgba(79,70,229,0.18)_55%,transparent_82%)] blur-[1px]" />
      <div className="pointer-events-none absolute -bottom-36 right-32 h-[310px] w-[180px] rotate-[62deg] rounded-full bg-[linear-gradient(180deg,rgba(124,58,237,0.72),rgba(59,130,246,0.18)_58%,transparent_86%)] blur-[1px]" />
      <div className="pointer-events-none absolute inset-x-8 bottom-20 h-px bg-gradient-to-r from-transparent via-indigo-300/45 to-transparent" />

      <div className="relative">
        <header className="pb-6">
          <div className="flex items-start justify-between gap-8">
            <div>
              <div>
                <p className="text-[27px] font-semibold leading-none tracking-[0.36em] text-white drop-shadow-[0_0_12px_rgba(147,197,253,0.48)]">
                  ENTRY
                </p>
                <p className="mt-2 pl-10 text-[10px] font-semibold uppercase tracking-[0.42em] text-white/90">
                  By Minerva Technologies
                </p>
              </div>

              <p className="mt-9 text-[11px] font-semibold uppercase tracking-[0.34em] text-fuchsia-200">
                Gestión de residentes
              </p>
              <h1 className="mt-3 max-w-[720px] text-[42px] font-semibold leading-[1] tracking-tight text-white drop-shadow-[0_0_18px_rgba(147,197,253,0.22)]">
                Revisión de residentes{" "}
                <span className="bg-gradient-to-r from-violet-200 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
                  por confirmar
                </span>
              </h1>
              <p className="mt-1 text-[26px] font-medium leading-tight text-slate-200">
                {report.communityName}
              </p>
              <p className="mt-2 max-w-[740px] text-[16px] leading-6 text-slate-300">
                Compartimos esta información para confirmar que los datos registrados
                son correctos. Si todo está correcto, podremos continuar con el proceso.
              </p>
            </div>

            <div className="min-w-56 pt-4 text-left">
              <div className="flex items-start gap-4">
                <span className="mt-1 h-px w-10 bg-violet-300/80" />
                <p className="text-[14px] leading-5 text-slate-200">
                  Tecnología que conecta
                  <br />
                  y protege comunidades.
                </p>
              </div>
              <div className="ml-20 mt-11 border-l border-sky-300/25 pl-4">
                <p className="text-[11px] text-slate-400">
                  Generado
                </p>
                <p className="mt-2 text-[11px] leading-5 text-slate-200">
                  {formatDate(report.generatedAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-4 gap-3">
            <ReportMetric
              icon={House}
              label="Viviendas"
              value={report.summary.unitCount}
            />
            <ReportMetric
              icon={Users}
              label="Residentes"
              value={report.summary.residentCount}
            />
            <ReportMetric
              icon={ClipboardList}
              label="Datos pendientes"
              value={report.summary.missingFieldCount}
              warning={report.summary.missingFieldCount > 0}
            />
            <ReportMetric
              icon={Mail}
              label="Correos faltantes"
              value={report.summary.missingEmailCount}
              warning={report.summary.missingEmailCount > 0}
            />
          </div>
        </header>

        <div className="space-y-4">
          {report.units.map((unit) => (
            <section
              key={unit.id}
              className="break-inside-avoid rounded-xl border border-violet-400/55 bg-[linear-gradient(145deg,rgba(9,31,68,0.92),rgba(6,21,45,0.92)_58%,rgba(20,18,71,0.88))] p-4 shadow-[0_0_34px_rgba(109,40,217,0.16),inset_0_1px_0_rgba(255,255,255,0.1)]"
            >
              <div className="flex items-start justify-between gap-5">
                <div className="flex min-w-0 gap-4">
                  <span className="grid size-14 shrink-0 place-items-center rounded-full border border-violet-200/30 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.28),rgba(124,58,237,0.78)_62%,rgba(67,56,202,0.7))] text-white shadow-[0_0_24px_rgba(139,92,246,0.36)]">
                    <House className="size-8 fill-white/95" />
                  </span>
                  <div className="min-w-0 pt-1">
                    <h2 className="text-[28px] font-semibold leading-none tracking-tight text-white">
                      {unit.unitLabel}
                    </h2>
                    <p
                      className={
                        unit.reference
                          ? "mt-3 flex items-center gap-2 text-[13px] leading-5 text-slate-300"
                          : "mt-3 flex items-center gap-2 text-[13px] leading-5 text-amber-200"
                      }
                    >
                      <span className="grid size-5 place-items-center rounded-full bg-violet-400/35 text-violet-100">
                        <MapPin className="size-3.5 fill-violet-100/40" />
                      </span>
                      <span>
                        Referencia: {unit.reference ?? "Referencia pendiente"}
                      </span>
                    </p>
                  </div>
                </div>
                <span className="mt-2 inline-flex shrink-0 items-center gap-2 rounded-full border border-violet-300/45 bg-violet-500/35 px-4 py-2 text-[13px] font-semibold text-violet-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
                  <Users className="size-4 fill-white/80" />
                  {unit.residents.length} residente
                  {unit.residents.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-sky-300/17 bg-[#06152c]/80">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-sky-300/[0.10]">
                    <tr className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-300/85">
                      <th className="w-12 px-4 py-3">#</th>
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-4 py-3">Correo</th>
                      <th className="px-4 py-3">Teléfono</th>
                      <th className="w-36 px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unit.residents.map((resident) => {
                      const status = residentStatus(resident);

                      return (
                        <tr
                          key={`${unit.id}-${resident.position}`}
                          className="border-t border-sky-200/[0.10] text-[13px]"
                        >
                          <td className="px-4 py-3 text-slate-300">
                            {resident.position}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-white">
                                {resident.fullName}
                              </span>
                              {resident.position === 1 ? (
                                <span className="rounded-full border border-violet-300/50 bg-violet-600/45 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-50">
                                  Titular
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td
                            className={
                              resident.email
                                ? "px-4 py-3 text-slate-200"
                                : "px-4 py-3 font-medium text-amber-200"
                            }
                          >
                            {resident.email ?? "Sin correo"}
                          </td>
                          <td
                            className={
                              resident.phone
                                ? "px-4 py-3 text-slate-200"
                                : "px-4 py-3 font-medium text-amber-200"
                            }
                          >
                            {resident.phone ?? "Sin teléfono"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                status.complete
                                  ? "inline-flex items-center gap-2 text-[12px] font-semibold text-emerald-300"
                                  : "inline-flex items-center gap-2 text-[12px] font-semibold text-amber-200"
                              }
                            >
                              {status.complete ? (
                                <CheckCircle2 className="size-4" />
                              ) : (
                                <AlertTriangle className="size-4" />
                              )}
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-5 rounded-xl border border-sky-300/10 bg-[#07152c]/68 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">
              Resumen de datos pendientes
            </h2>
            <span
              className={
                report.summary.missingFieldCount > 0
                  ? "rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200"
                  : "rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200"
              }
            >
              {report.summary.missingFieldCount}
            </span>
          </div>

          {report.summary.missingFieldCount === 0 ? (
            <div className="mt-4 flex items-center gap-6 rounded-xl border border-emerald-300/70 bg-emerald-400/[0.16] px-6 py-5 text-emerald-100 shadow-[0_0_36px_rgba(16,185,129,0.14),inset_0_1px_0_rgba(255,255,255,0.08)]">
              <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-emerald-300 text-emerald-200">
                <CheckCircle2 className="size-8" />
              </span>
              <span className="h-12 w-px bg-emerald-300/55" />
              <div>
                <p className="text-base font-semibold">
                  Todos los datos requeridos están completos.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {report.units.flatMap((unit) =>
                unit.missingFields.map((field, index) => (
                  <div
                    key={`${unit.id}-${field.code}-${field.residentPosition ?? "unit"}-${index}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-amber-300/22 bg-amber-400/[0.09] px-4 py-3 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <AlertTriangle className="size-4 shrink-0 text-amber-200" />
                      <span className="truncate text-slate-100">
                        {unit.unitLabel}
                        {field.residentName ? ` · ${field.residentName}` : ""}
                      </span>
                    </div>
                    <span className="shrink-0 font-semibold text-amber-200">
                      {reportMissingFieldMessage(field)}
                    </span>
                  </div>
                )),
              )}
            </div>
          )}
        </section>

        <footer className="mt-6 flex items-end justify-between gap-6 border-t border-indigo-300/30 pt-5 text-[10px] leading-4 text-slate-400">
          <p className="max-w-[560px]">
            Este informe fue generado desde Minerva Console con los datos actuales
            del registro.
            <br />
            Generarlo no cambia el estado de revisión ni confirma información por el Patronato.
          </p>
          <div className="shrink-0 text-right">
            <p className="text-slate-400">
              Menos fricción.
                <br />
              Más confianza.
            </p>
            <p className="mt-3 text-[11px] uppercase tracking-[0.32em] text-slate-300">
              ENTRY | MINERVA
            </p>
          </div>
        </footer>
      </div>
    </article>
  );
}

function ReportMetric({
  icon: Icon,
  label,
  value,
  warning = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className="rounded-xl border border-sky-300/25 bg-sky-500/[0.075] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-center gap-4">
        <span
          className={
            warning
              ? "grid size-14 place-items-center rounded-full border border-amber-200/25 bg-amber-400/16 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.18)]"
              : "grid size-14 place-items-center rounded-full border border-violet-200/30 bg-violet-500/45 text-white shadow-[0_0_24px_rgba(139,92,246,0.32)]"
          }
        >
          <Icon className="size-7" />
        </span>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            {label}
          </p>
          <p
            className={
              warning
                ? "mt-1 text-[31px] font-semibold leading-none text-amber-100"
                : "mt-1 text-[31px] font-semibold leading-none text-white"
            }
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ConfirmationReportDrawer({
  mode,
  onClose,
  report,
}: ConfirmationReportDrawerProps) {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportPng() {
    const node = reportRef.current;
    if (!node) return;

    setExportError(null);
    setExporting("png");

    try {
      const dataUrl = await renderNodeToPng(node);
      downloadUrl(dataUrl, reportFilename(report, "png"));
    } catch (error) {
      console.error("ENTRY_CONFIRMATION_REPORT_PNG_FAILED", error);
      setExportError("The PNG could not be exported. Try again.");
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    const node = reportRef.current;
    if (!node) return;

    setExportError(null);
    setExporting("pdf");

    try {
      const dataUrl = await renderNodeToPng(node);
      const { PDFDocument, rgb } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      const image = await pdf.embedPng(dataUrl);
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const renderedHeight = (image.height / image.width) * pageWidth;
      const pageCount = Math.max(1, Math.ceil(renderedHeight / pageHeight));

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const page = pdf.addPage([pageWidth, pageHeight]);
        page.drawRectangle({
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
          color: rgb(11 / 255, 14 / 255, 20 / 255),
        });
        page.drawImage(image, {
          x: 0,
          y: pageHeight - renderedHeight + pageIndex * pageHeight,
          width: pageWidth,
          height: renderedHeight,
        });
      }

      const bytes = await pdf.save();
      const arrayBuffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(arrayBuffer).set(bytes);
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      downloadUrl(url, reportFilename(report, "pdf"));
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("ENTRY_CONFIRMATION_REPORT_PDF_FAILED", error);
      setExportError("The PDF could not be exported. Try again.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/65 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close report preview"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-[min(820px,100vw)] flex-col border-l border-white/10 bg-[#10131a] shadow-2xl">
        <header className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-violet-300" />
                <h2 className="text-base font-semibold text-white">Report preview</h2>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                This is how the report will appear to the Patronato.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-white/10 bg-black/15 p-1 text-xs font-semibold">
            <div
              className={
                mode === "single"
                  ? "rounded-md bg-violet-500 px-3 py-2 text-center text-white"
                  : "px-3 py-2 text-center text-slate-400"
              }
            >
              Single unit
            </div>
            <div
              className={
                mode === "selection"
                  ? "rounded-md bg-violet-500 px-3 py-2 text-center text-white"
                  : "px-3 py-2 text-center text-slate-400"
              }
            >
              Selected units ({report.summary.unitCount})
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-500/[0.08] px-3 py-2.5 text-xs text-sky-100">
            <Mail className="size-4 text-sky-300" />
            The report includes {report.summary.unitCount} {report.summary.unitCount === 1 ? "unit" : "units"} with{" "}
            {report.summary.residentCount} {report.summary.residentCount === 1 ? "resident" : "residents"}.
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-[#0a0c11] p-5">
          <div
            ref={reportRef}
            className="mx-auto w-fit overflow-hidden rounded-xl border border-white/10 shadow-2xl"
          >
            <ReportDocument report={report} />
          </div>
        </div>

        <footer className="border-t border-white/10 bg-[#11151d] px-5 py-4">
          {exportError ? (
            <p className="mb-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {exportError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={Boolean(exporting)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={exportPng}
              disabled={Boolean(exporting)}
              className="gap-2"
            >
              <Download className="size-4" />
              {exporting === "png" ? "Exporting..." : "Export PNG"}
            </Button>
            <Button
              type="button"
              onClick={exportPdf}
              disabled={Boolean(exporting)}
              className="gap-2"
            >
              <Download className="size-4" />
              {exporting === "pdf" ? "Exporting..." : "Export PDF"}
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
