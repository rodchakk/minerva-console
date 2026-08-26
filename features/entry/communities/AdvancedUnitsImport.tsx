"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
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
  const fileName = file?.name ?? null;

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
      <div>
        <h3 className="text-xl font-semibold text-white">Import resident data</h3>
        <p className="mt-1 text-xs text-[var(--console-text-muted)] max-w-3xl">
          Import units and residents into the Activation Queue. No active ENTRY
          users or final PINs are created from this step.
        </p>
      </div>

      {/* Step 1: Add source */}
      <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-5 space-y-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--console-border)] text-xs font-semibold text-white">
            1
          </span>
          <h4 className="text-sm font-semibold text-white">Add source</h4>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] lg:items-center">
          {/* File Upload Column */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-white">Upload file</p>
              <p className="mt-0.5 text-xs text-[var(--console-text-muted)]">
                Upload a file or spreadsheet.
              </p>
            </div>

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
              className="w-full rounded-md border border-dashed border-[var(--console-border-strong)] bg-white/[0.015] p-5 text-center transition hover:border-violet-400/40 hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
            >
              <Upload className="mx-auto h-6 w-6 stroke-[1.75] text-violet-400" />
              <p className="mt-2 text-xs font-semibold text-white">
                {fileName ? fileName : "Choose file"}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--console-text-muted)]">
                {fileName ? "Click to change file" : "Select a spreadsheet file"}
              </p>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-xs text-[var(--console-text-muted)]">
                Accepted formats: <code className="text-slate-300">.xlsx</code> and <code className="text-slate-300">.csv</code>
              </p>
              <button
                type="button"
                onClick={downloadAdvancedUnitsTemplate}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300 transition-colors hover:text-violet-100"
              >
                <Download className="h-3.5 w-3.5 stroke-[1.75]" />
                <span>Download template</span>
              </button>
            </div>
          </div>

          {/* OR Separator */}
          <div className="flex items-center justify-center py-2 lg:flex-col lg:py-0">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--console-border)] bg-[var(--console-surface)] text-[10px] font-semibold text-[var(--console-text-muted)]">
              OR
            </span>
          </div>

          {/* Paste Spreadsheet Column */}
          <div className="space-y-3">
            <div>
              <label
                className="block text-sm font-semibold text-white"
                htmlFor="units_import_paste"
              >
                Paste spreadsheet data
              </label>
              <p className="mt-0.5 text-xs text-[var(--console-text-muted)]">
                CSV or tab-separated data is supported.
              </p>
            </div>
            <textarea
              id="units_import_paste"
              rows={6}
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              className="w-full rounded-md border border-[var(--console-border)] bg-[var(--console-surface)] p-3 font-mono text-xs text-slate-100 outline-none transition placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
              placeholder={
                "Unit Label,Resident Name,Phone,Email,Is Owner\nCasa 1,Ana Perez,9999-9999,ana@example.com,Yes\nCasa 2,Carlos Lopez,8888-8888,,No"
              }
            />
          </div>
        </div>

        {/* Footer controls inside Add source */}
        <div className="flex flex-col gap-3 border-t border-[var(--console-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={clearImport}
            className="self-start text-xs font-semibold text-[var(--console-text-muted)] transition-colors hover:text-slate-200"
          >
            Clear
          </button>

          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <p className="hidden max-w-md truncate text-xs text-[var(--console-text-muted)] sm:block">
              {statusMessage}
            </p>
            <button
              type="button"
              onClick={handleParse}
              disabled={isParsing}
              className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--console-accent)] px-4 text-xs font-semibold text-white transition-colors hover:bg-[var(--console-accent-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50 disabled:opacity-50"
            >
              {isParsing ? "Parsing import..." : "Preview import"}
            </button>
          </div>
        </div>
      </div>

      {/* Step 2: Import preview */}
      {value ? (
        <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold text-white">2. Import preview</h4>
                <Badge tone="info">{value.parsedResidentRows} rows</Badge>
              </div>
              <p className="text-xs text-[var(--console-text-muted)]">
                Review the data before creating the community.
              </p>
            </div>
            <p className="text-xs text-[var(--console-text-muted)]">Source: {value.sourceName}</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-md border border-[var(--console-border)] bg-[var(--console-surface)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                Units detected
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {value.uniqueUnitLabels.length}
              </p>
            </div>
            <div className="rounded-md border border-[var(--console-border)] bg-[var(--console-surface)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                Rows ready
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {Math.max(value.parsedResidentRows - value.errors.length, 0)}
              </p>
            </div>
            <div className="rounded-md border border-[var(--console-border)] bg-[var(--console-surface)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                Errors
              </p>
              <p className="mt-1 text-lg font-semibold text-white">{value.errors.length}</p>
            </div>
          </div>

          {value.errors.length > 0 ? (
            <div className="rounded-md border border-rose-400/20 bg-rose-500/10 p-4">
              <p className="text-xs font-semibold text-rose-200">Blocking errors</p>
              <ul className="mt-2 space-y-1 text-xs text-rose-100">
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
            <div className="rounded-md border border-amber-400/20 bg-amber-500/10 p-4">
              <p className="text-xs font-semibold text-amber-200">Warnings</p>
              <ul className="mt-2 space-y-1 text-xs text-amber-100">
                {value.warnings.map((issue, index) => (
                  <li key={`warning-${issue.rowNumber ?? "general"}-${index}`}>
                    {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs text-[var(--console-text-muted)]">
            Blank rows ignored: {value.blankRowsIgnored}. Duplicate unit labels are
            normalized and will only be created once on final submit.
          </p>

          <div className="overflow-x-auto rounded-md border border-[var(--console-border)]">
            <div className="max-h-[24rem] overflow-y-auto">
              <table className="min-w-full divide-y divide-[var(--console-border)] text-left text-xs">
                <thead className="sticky top-0 bg-[var(--console-surface-raised)] text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Unit Label</th>
                    <th className="px-4 py-2.5 font-semibold">Resident Name</th>
                    <th className="px-4 py-2.5 font-semibold">Phone</th>
                    <th className="px-4 py-2.5 font-semibold">Email</th>
                    <th className="px-4 py-2.5 font-semibold">Is Owner</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--console-border)] bg-[var(--console-surface)] text-slate-200">
                  {value.rows.length > 0 ? (
                    value.rows.map((row) => (
                      <tr key={`preview-row-${row.rowNumber}`}>
                        <td className="px-4 py-2.5">{row.unitLabel || "-"}</td>
                        <td className="px-4 py-2.5">{row.residentName || "-"}</td>
                        <td className="px-4 py-2.5">{row.phone || "-"}</td>
                        <td className="px-4 py-2.5">{row.email || "-"}</td>
                        <td className="px-4 py-2.5">{row.isOwner || "-"}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center rounded-[4px] border border-emerald-400/20 bg-emerald-500/[0.08] px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                            {row.residentStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-center text-[var(--console-text-muted)]" colSpan={6}>
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
