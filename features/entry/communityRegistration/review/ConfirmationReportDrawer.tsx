"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
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
      label: resident.missingFields[0].message,
    };
  }

  return {
    complete: false,
    label: `${resident.missingFields.length} datos pendientes`,
  };
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
    <article className="w-[720px] bg-[#0b0e14] px-7 py-7 text-[#f7f7fb]">
      <header className="border-b border-white/10 pb-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-violet-300">
              <span className="grid size-6 place-items-center rounded-md border border-violet-400/40 bg-violet-500/10">
                M
              </span>
              Minerva
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
              Revisión de residentes por confirmar
            </h1>
            <p className="mt-1 text-sm text-slate-300">{report.communityName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">
              ENTRY
            </p>
            <p className="mt-5 text-xs text-slate-400">
              Generado {formatDate(report.generatedAt)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2">
          <ReportMetric label="Viviendas" value={report.summary.unitCount} />
          <ReportMetric label="Residentes" value={report.summary.residentCount} />
          <ReportMetric
            label="Datos pendientes"
            value={report.summary.missingFieldCount}
            warning={report.summary.missingFieldCount > 0}
          />
          <ReportMetric
            label="Correos faltantes"
            value={report.summary.missingEmailCount}
            warning={report.summary.missingEmailCount > 0}
          />
        </div>
      </header>

      <div className="mt-6 space-y-7">
        {report.units.map((unit) => (
          <section key={unit.id} className="break-inside-avoid">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">{unit.unitLabel}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Referencia:{" "}
                  <span className={unit.reference ? "text-slate-200" : "text-amber-300"}>
                    {unit.reference ?? "Pendiente"}
                  </span>
                </p>
              </div>
              <p className="text-xs text-slate-400">
                {unit.residents.length} residente
                {unit.residents.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
              <table className="w-full border-collapse text-left">
                <thead className="bg-white/[0.055]">
                  <tr className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                    <th className="w-8 px-2 py-2">#</th>
                    <th className="px-2 py-2">Nombre</th>
                    <th className="px-2 py-2">Correo</th>
                    <th className="px-2 py-2">Teléfono</th>
                    <th className="w-28 px-2 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {unit.residents.map((resident) => {
                    const status = residentStatus(resident);

                    return (
                      <tr
                        key={`${unit.id}-${resident.position}`}
                        className="border-t border-white/[0.07] text-[10px]"
                      >
                        <td className="px-2 py-2.5 text-slate-400">{resident.position}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-white">{resident.fullName}</span>
                            {resident.position === 1 ? (
                              <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-violet-200">
                                Titular
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td
                          className={
                            resident.email ? "px-2 py-2.5 text-slate-200" : "px-2 py-2.5 text-amber-300"
                          }
                        >
                          {resident.email ?? "—"}
                        </td>
                        <td
                          className={
                            resident.phone ? "px-2 py-2.5 text-slate-200" : "px-2 py-2.5 text-amber-300"
                          }
                        >
                          {resident.phone ?? "—"}
                        </td>
                        <td className="px-2 py-2.5">
                          <span
                            className={
                              status.complete
                                ? "inline-flex items-center gap-1 text-emerald-300"
                                : "inline-flex items-center gap-1 text-amber-300"
                            }
                          >
                            {status.complete ? (
                              <CheckCircle2 className="size-3" />
                            ) : (
                              <AlertTriangle className="size-3" />
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

      <section className="mt-7 border-t border-white/10 pt-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-white">Resumen de datos pendientes</h2>
          <span
            className={
              report.summary.missingFieldCount > 0
                ? "rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300"
                : "rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300"
            }
          >
            {report.summary.missingFieldCount}
          </span>
        </div>

        {report.summary.missingFieldCount === 0 ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/[0.08] px-3 py-3 text-xs text-emerald-200">
            <CheckCircle2 className="size-4" />
            Todos los datos requeridos están completos.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {report.units.flatMap((unit) =>
              unit.missingFields.map((field, index) => (
                <div
                  key={`${unit.id}-${field.code}-${field.residentPosition ?? "unit"}-${index}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-amber-400/15 bg-amber-500/[0.06] px-3 py-2.5 text-xs"
                >
                  <span className="text-slate-200">
                    {unit.unitLabel}
                    {field.residentName ? ` · ${field.residentName}` : ""}
                  </span>
                  <span className="font-medium text-amber-300">{field.message}</span>
                </div>
              )),
            )}
          </div>
        )}
      </section>

      <footer className="mt-7 flex items-end justify-between gap-6 border-t border-white/10 pt-4 text-[9px] leading-4 text-slate-500">
        <p>
          Este informe fue generado desde Minerva Console con los datos actuales del registro.
          Generarlo no cambia el estado de revisión ni confirma información por el Patronato.
        </p>
        <p className="shrink-0 text-right">
          Unidades fuertes.
          <br />
          Comunidades mejores.
        </p>
      </footer>
    </article>
  );
}

function ReportMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5">
      <p className="text-[8px] font-semibold uppercase tracking-[0.13em] text-slate-500">
        {label}
      </p>
      <p className={warning ? "mt-1 text-lg font-semibold text-amber-300" : "mt-1 text-lg font-semibold text-white"}>
        {value}
      </p>
    </div>
  );
}

export function ConfirmationReportDrawer({
  mode,
  onClose,
  report,
}: ConfirmationReportDrawerProps) {
  const reportRef = useRef<HTMLElement | null>(null);
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
      setExportError("No se pudo exportar el PNG. Inténtalo nuevamente.");
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
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      downloadUrl(url, reportFilename(report, "pdf"));
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("ENTRY_CONFIRMATION_REPORT_PDF_FAILED", error);
      setExportError("No se pudo exportar el PDF. Inténtalo nuevamente.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/65 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Cerrar vista previa"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-[min(820px,100vw)] flex-col border-l border-white/10 bg-[#10131a] shadow-2xl">
        <header className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-violet-300" />
                <h2 className="text-base font-semibold text-white">Vista previa del informe</h2>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Así se verá el reporte para el Patronato.
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
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
              Una vivienda
            </div>
            <div
              className={
                mode === "selection"
                  ? "rounded-md bg-violet-500 px-3 py-2 text-center text-white"
                  : "px-3 py-2 text-center text-slate-400"
              }
            >
              Viviendas seleccionadas ({report.summary.unitCount})
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-500/[0.08] px-3 py-2.5 text-xs text-sky-100">
            <Mail className="size-4 text-sky-300" />
            El informe incluirá {report.summary.unitCount} vivienda
            {report.summary.unitCount === 1 ? "" : "s"} con {report.summary.residentCount} residentes.
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-[#0a0c11] p-5">
          <div className="mx-auto w-fit overflow-hidden rounded-xl border border-white/10 shadow-2xl">
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
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={exportPng}
              disabled={Boolean(exporting)}
              className="gap-2"
            >
              <Download className="size-4" />
              {exporting === "png" ? "Exportando..." : "Exportar PNG"}
            </Button>
            <Button
              type="button"
              onClick={exportPdf}
              disabled={Boolean(exporting)}
              className="gap-2"
            >
              <Download className="size-4" />
              {exporting === "pdf" ? "Exportando..." : "Exportar PDF"}
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
