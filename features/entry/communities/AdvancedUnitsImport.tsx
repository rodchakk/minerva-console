"use client";

import { useRef, useState } from "react";
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
    "Upload a file or paste spreadsheet rows, then parse the data to preview it before creating anything.",
  );
  const [isParsing, setIsParsing] = useState(false);

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
        `Preview ready from ${nextValue.sourceName}. ${nextValue.uniqueUnitLabels.length} unique units prepared for creation.`,
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
      "Upload a file or paste spreadsheet rows, then parse the data to preview it before creating anything.",
    );
    onChange(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
        <p className="text-sm font-semibold text-amber-100">
          Resident data will be previewed but not created yet in this version.
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-50/90">
          Units will be prepared for import, while resident columns remain visible
          so the structure is ready for a future backend release.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={downloadAdvancedUnitsTemplate}>
          Download template
        </Button>
        <Button type="button" variant="ghost" onClick={clearImport}>
          Clear import
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3 rounded-3xl border border-white/8 bg-[var(--surface-strong)] p-5">
          <label className="text-sm font-medium text-slate-200" htmlFor="units_import_file">
            Upload Excel or CSV
          </label>
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
              }
            }}
            className="block w-full rounded-2xl border border-[var(--border)] bg-[rgba(9,12,24,0.72)] px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-2xl file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:font-semibold file:text-white"
          />
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            Accepted formats: <code>.xlsx</code> and <code>.csv</code>.
          </p>
        </div>

        <div className="space-y-3 rounded-3xl border border-white/8 bg-[var(--surface-strong)] p-5">
          <label className="text-sm font-medium text-slate-200" htmlFor="units_import_paste">
            Or paste spreadsheet data
          </label>
          <textarea
            id="units_import_paste"
            rows={5}
            value={pasteValue}
            onChange={(event) => setPasteValue(event.target.value)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[rgba(9,12,24,0.72)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
            placeholder={
              "Unit Label,Resident Name,Phone,Email,Is Owner\nCasa 1,Ana Perez,9999-9999,ana@example.com,Yes"
            }
          />
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            CSV and tab-separated spreadsheet paste are supported.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleParse} disabled={isParsing}>
          {isParsing ? "Parsing import..." : "Parse data"}
        </Button>
        <p className="text-sm leading-6 text-[var(--text-muted)]">{statusMessage}</p>
      </div>

      {value ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Unique units to create", value: value.uniqueUnitLabels.length },
              { label: "Resident rows prepared", value: value.parsedResidentRows },
              { label: "Errors", value: value.errors.length },
              { label: "Warnings", value: value.warnings.length },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-3xl border border-white/8 bg-[var(--surface-elevated)] p-4"
              >
                <p className="text-sm text-[var(--text-muted)]">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Validation summary
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                  Blank rows ignored: {value.blankRowsIgnored}. Duplicate unit labels
                  are allowed and will only be created once on final submit.
                </p>
              </div>
              <p className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-slate-200">
                Preview only
              </p>
            </div>

            {value.errors.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
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
            ) : (
              <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                No blocking import errors found.
              </p>
            )}

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
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">Preview table</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                  Nothing is created on upload or parse. Records are only created
                  when you press the main Create community button.
                </p>
              </div>
              <p className="text-sm font-medium text-[var(--text-muted)]">
                Source: {value.sourceName}
              </p>
            </div>

            <div className="mt-4 overflow-x-auto">
              <div className="max-h-[24rem] overflow-y-auto rounded-2xl border border-[var(--border)]">
                <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                  <thead className="sticky top-0 bg-[rgba(9,12,24,0.95)] text-slate-300 backdrop-blur">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Row</th>
                      <th className="px-4 py-3 font-semibold">Unit Label</th>
                      <th className="px-4 py-3 font-semibold">Resident Name</th>
                      <th className="px-4 py-3 font-semibold">Phone</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Is Owner</th>
                      <th className="px-4 py-3 font-semibold">Resident Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] text-slate-200">
                    {value.rows.length > 0 ? (
                      value.rows.map((row) => (
                        <tr key={`preview-row-${row.rowNumber}`}>
                          <td className="px-4 py-3">{row.rowNumber}</td>
                          <td className="px-4 py-3">{row.unitLabel || "-"}</td>
                          <td className="px-4 py-3">{row.residentName || "-"}</td>
                          <td className="px-4 py-3">{row.phone || "-"}</td>
                          <td className="px-4 py-3">{row.email || "-"}</td>
                          <td className="px-4 py-3">{row.isOwner || "-"}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-amber-500/12 px-3 py-1 text-xs font-semibold text-amber-200">
                              {row.residentStatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-6 text-[var(--text-muted)]" colSpan={7}>
                          No non-blank rows were found in this import.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
