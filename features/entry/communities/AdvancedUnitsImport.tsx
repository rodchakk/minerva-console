"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  type AdvancedUnitsImportPayload,
  downloadAdvancedUnitsTemplate,
  parseAdvancedUnitsFile,
  parseAdvancedUnitsText,
} from "@/features/entry/communities/unitsImport";

type AdvancedUnitsImportProps = {
  onChange: (value: AdvancedUnitsImportPayload | null) => void;
  value: AdvancedUnitsImportPayload | null;
};

export function AdvancedUnitsImport({
  onChange,
  value,
}: AdvancedUnitsImportProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pasteValue, setPasteValue] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "Upload a file or paste spreadsheet rows, then parse the data to review it before creating anything.",
  );
  const [isParsing, setIsParsing] = useState(false);
  const fileName = file?.name ?? "No file chosen";

  async function handleParse() {
    if (!file && !pasteValue.trim()) {
      setStatusMessage("Choose a file or paste spreadsheet data before parsing.");
      onChange(null);
      return;
    }

    setIsParsing(true);

    try {
      const nextValue = file
        ? await parseAdvancedUnitsFile(file)
        : parseAdvancedUnitsText(pasteValue);

      onChange(nextValue);
      setStatusMessage(
        `Preview ready from ${nextValue.sourceName}. ${nextValue.uniqueUnitLabels.length} unique units and ${nextValue.parsedResidentRows} resident rows prepared.`,
      );
    } catch (error) {
      onChange(null);
      setStatusMessage(
        error instanceof Error
          ? `We could not parse this import: ${error.message}`
          : "We could not parse this import. Try the template file or paste plain CSV/TSV data.",
      );
    } finally {
      setIsParsing(false);
    }
  }

  function clearImport() {
    setFile(null);
    setPasteValue("");
    setStatusMessage(
      "Upload a file or paste spreadsheet rows, then parse the data to review it before creating anything.",
    );
    onChange(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-white">Import resident data</h3>
        <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
          Import units and residents into the Activation Queue. No active ENTRY
          users or final PINs are created from this step.
        </p>
      </div>

      <div className="rounded-[26px] border border-white/8 bg-[rgba(12,17,25,0.58)] p-5">
        <div className="space-y-1">
          <h4 className="text-base font-semibold text-white">1. Add source</h4>
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            Upload a file or paste spreadsheet data.
          </p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] lg:items-start">
          <div className="space-y-3">
            <label
              className="text-sm font-medium text-slate-200"
              htmlFor="units_import_file"
            >
              Upload file
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                ref={fileInputRef}
                id="units_import_file"
                type="file"
                accept=".xlsx,.csv"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setFile(nextFile);
                  if (nextFile) {
                    setStatusMessage(
                      `${nextFile.name} selected. Parse the data to review units and resident rows before community creation.`,
                    );
                  } else {
                    setStatusMessage(
                      "Upload a file or paste spreadsheet rows, then parse the data to review it before creating anything.",
                    );
                  }
                }}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-violet-400/25 bg-[var(--primary-soft)] px-4 text-sm font-semibold text-white transition hover:border-violet-300/35 hover:bg-violet-500/20"
              >
                Choose file
              </button>
              <span className="text-sm text-[var(--text-muted)]">{fileName}</span>
            </div>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Accepted formats: <code>.xlsx</code> and <code>.csv</code>.
            </p>
          </div>

          <div className="hidden h-full items-center justify-center lg:flex">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              or
            </span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label
                className="text-sm font-medium text-slate-200"
                htmlFor="units_import_paste"
              >
                Paste spreadsheet data
              </label>
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                CSV or tab-separated data is supported.
              </p>
            </div>
            <textarea
              id="units_import_paste"
              rows={5}
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              className="w-full rounded-[22px] border border-white/10 bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/50"
              placeholder={
                "Unit Label,Resident Name,Phone,Email,Is Owner\nCasa 1,Ana Perez,9999-9999,ana@example.com,Yes\nCasa 2,Carlos Lopez,8888-8888,,No"
              }
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-white/8 pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={downloadAdvancedUnitsTemplate}
            >
              Download template
            </Button>
            <Button type="button" variant="ghost" onClick={clearImport}>
              Clear
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm leading-6 text-[var(--text-muted)]">{statusMessage}</p>
            <Button type="button" onClick={handleParse} disabled={isParsing}>
              {isParsing ? "Parsing import..." : "Preview import"}
            </Button>
          </div>
        </div>
      </div>

      {value ? (
        <div className="rounded-[26px] border border-white/8 bg-[rgba(12,17,25,0.58)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold text-white">2. Import preview</h4>
                <Badge tone="info">{value.parsedResidentRows} rows</Badge>
              </div>
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                Review the data before creating the community.
              </p>
            </div>
            <p className="text-sm text-[var(--text-muted)]">Source: {value.sourceName}</p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <div className="rounded-[20px] border border-white/8 bg-[var(--surface-strong)] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Units detected
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {value.uniqueUnitLabels.length}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/8 bg-[var(--surface-strong)] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Rows ready
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {Math.max(value.parsedResidentRows - value.errors.length, 0)}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/8 bg-[var(--surface-strong)] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Errors
              </p>
              <p className="mt-2 text-lg font-semibold text-white">{value.errors.length}</p>
            </div>
          </div>

          {value.errors.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
              <p className="text-sm font-semibold text-rose-200">Blocking errors</p>
              <ul className="mt-2 space-y-2 text-sm text-rose-100">
                {value.errors.map((issue, index) => (
                  <li key={`error-${issue.rowNumber ?? "general"}-${index}`}>
                    {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {value.warnings.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold text-amber-200">Warnings</p>
              <ul className="mt-2 space-y-2 text-sm text-amber-100">
                {value.warnings.map((issue, index) => (
                  <li key={`warning-${issue.rowNumber ?? "general"}-${index}`}>
                    {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
            Blank rows ignored: {value.blankRowsIgnored}. Duplicate unit labels are
            normalized and will only be created once on final submit.
          </p>

          <div className="mt-5 overflow-x-auto rounded-[22px] border border-[var(--border)]">
            <div className="max-h-[24rem] overflow-y-auto">
                <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                  <thead className="sticky top-0 bg-[rgba(9,12,24,0.95)] text-slate-300 backdrop-blur">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Unit Label</th>
                      <th className="px-4 py-3 font-semibold">Resident Name</th>
                      <th className="px-4 py-3 font-semibold">Phone</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Is Owner</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] text-slate-200">
                    {value.rows.length > 0 ? (
                      value.rows.map((row) => (
                        <tr key={`preview-row-${row.rowNumber}`}>
                          <td className="px-4 py-3">{row.unitLabel || "-"}</td>
                          <td className="px-4 py-3">{row.residentName || "-"}</td>
                          <td className="px-4 py-3">{row.phone || "-"}</td>
                          <td className="px-4 py-3">{row.email || "-"}</td>
                          <td className="px-4 py-3">{row.isOwner || "-"}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-200">
                              {row.residentStatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-6 text-[var(--text-muted)]" colSpan={6}>
                          No non-blank rows were found in this import.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
