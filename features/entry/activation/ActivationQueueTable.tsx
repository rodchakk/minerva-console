"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ActivationQueueRow } from "@/features/entry/activation/actions";
import { generateActivationPins } from "@/features/entry/activation/pinActions";
import type {
  GeneratePinItem,
  GeneratePinsActionResult,
} from "@/features/entry/activation/pinActions";

type ActivationQueueTableProps = {
  communityId: string;
  communityName: string;
  rows: ActivationQueueRow[];
};

const PLACEHOLDER_ACTIONS = [
  "Send email invite",
  "Copy WhatsApp message",
  "Mark skipped",
] as const;

function getStatusTone(
  status: string,
): "danger" | "default" | "info" | "success" | "warning" {
  switch (status) {
    case "activated":
      return "success";
    case "failed":
      return "danger";
    case "invited":
    case "pin_generated":
      return "info";
    case "skipped":
      return "default";
    default:
      return "warning";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "failed":
      return "Error";
    case "invited":
      return "Invited";
    case "pin_generated":
      return "PIN Generated";
    case "skipped":
      return "Skipped";
    case "activated":
      return "Activated";
    default:
      return "Pending";
  }
}

function getMethodTone(
  method: string,
): "default" | "info" | "success" | "warning" {
  switch (method) {
    case "email":
      return "info";
    case "phone_pin":
      return "warning";
    case "username_pin":
      return "success";
    default:
      return "default";
  }
}

function getMethodLabel(method: string) {
  switch (method) {
    case "email":
      return "Email";
    case "phone_pin":
      return "Phone PIN";
    case "username_pin":
      return "Username + PIN";
    default:
      return "Not configured";
  }
}

function buildWhatsAppMessage(item: GeneratePinItem, communityName: string) {
  const username = item.suggested_username
    ? item.suggested_username
    : "Se confirmará durante activación";

  const lines = [
    `Hola ${item.resident_name ?? "residente"}, tu activación de ENTRY está lista.`,
    "",
  ];

  if (communityName) {
    lines.push(`Comunidad: ${communityName}`);
  }
  lines.push(`Unidad: ${item.unit_label ?? "—"}`);
  lines.push(`Usuario: ${username}`);
  lines.push(`PIN de activación: ${item.pin ?? "—"}`);
  lines.push("");
  lines.push('Abrí la app ENTRY y seleccioná "Activar cuenta".');

  return lines.join("\n");
}

// ── Result modal ──────────────────────────────────────────────────────────────

function ResultModal({
  result,
  communityName,
  onClose,
}: {
  result: GeneratePinsActionResult;
  communityName: string;
  onClose: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!result.success) {
    return (
      <Overlay>
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[28px] bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-950">
            PIN generation failed
          </h3>
          <p className="text-sm text-slate-600">{result.error}</p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </Overlay>
    );
  }

  const { data } = result;
  const generatedItems = data.items.filter(
    (item) => item.status === "pin_generated",
  );
  const otherItems = data.items.filter((item) => item.status !== "pin_generated");
  const isPartialFailure = data.failed_count > 0;
  const isAllFailed =
    data.generated_count === 0 && data.failed_count > 0;

  function copyMessage(item: GeneratePinItem) {
    const text = buildWhatsAppMessage(item, communityName);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(item.queue_id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function copyAll() {
    const text = generatedItems
      .map((item) => buildWhatsAppMessage(item, communityName))
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  }

  return (
    <Overlay>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[28px] bg-white shadow-xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-950">
            PIN generation results
          </h3>
          <div className="mt-3 flex flex-wrap gap-3">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              {data.generated_count} generated
            </span>
            {data.skipped_count > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {data.skipped_count} skipped
              </span>
            )}
            {data.failed_count > 0 && (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                {data.failed_count} failed
              </span>
            )}
          </div>

          {isAllFailed && (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm font-semibold text-rose-900">
                All selected rows failed. Check that the residents are in a
                valid state and try again.
              </p>
            </div>
          )}

          {isPartialFailure && !isAllFailed && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">
                {data.failed_count} row{data.failed_count !== 1 ? "s" : ""}{" "}
                failed. PINs were generated for the rest.
              </p>
            </div>
          )}

          {generatedItems.length > 0 && (
            <div className="mt-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
              <p className="text-sm font-semibold text-teal-900">
                Save or copy these PINs now. For security, this screen may not
                show them again after you close it.
              </p>
            </div>
          )}
        </div>

        {/* Scrollable items */}
        <div className="flex-1 overflow-y-auto p-6">
          {generatedItems.length > 0 && (
            <div className="space-y-3">
              {generatedItems.map((item) => (
                <div
                  key={item.queue_id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-slate-900">
                        {item.resident_name ?? "Unnamed resident"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.unit_label ?? "—"}
                        {item.email ? ` · ${item.email}` : ""}
                        {item.phone ? ` · ${item.phone}` : ""}
                      </p>
                      {item.suggested_username && (
                        <p className="text-xs text-slate-600">
                          Username:{" "}
                          <span className="font-medium">
                            {item.suggested_username}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      <div className="rounded-xl border border-teal-300 bg-white px-4 py-2 text-center">
                        <p className="text-xs font-medium text-slate-500">
                          Activation PIN
                        </p>
                        <p className="font-mono text-xl font-bold tracking-widest text-teal-700">
                          {item.pin}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => copyMessage(item)}
                      >
                        {copiedId === item.queue_id
                          ? "Copied!"
                          : "Copy WhatsApp message"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Skipped / failed rows */}
          {otherItems.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Skipped / failed
              </p>
              {otherItems.map((item) => (
                <div
                  key={item.queue_id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <span className="text-slate-700">
                    {item.resident_name ?? item.queue_id}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={item.status === "failed" ? "danger" : "default"}
                    >
                      {item.status}
                    </Badge>
                    {item.message && (
                      <span className="text-xs text-slate-400">
                        {item.message}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 p-6">
          {generatedItems.length > 1 && (
            <Button type="button" variant="secondary" onClick={copyAll}>
              {copiedAll ? "Copied!" : "Copy all messages"}
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {children}
    </div>
  );
}

// ── Main table ────────────────────────────────────────────────────────────────

export function ActivationQueueTable({
  communityId,
  communityName,
  rows,
}: ActivationQueueTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const visibleRowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const allVisibleSelected =
    visibleRowIds.length > 0 &&
    visibleRowIds.every((rowId) => selectedIds.includes(rowId));
  const selectedCount = selectedIds.length;

  type Phase = "idle" | "confirming" | "loading" | "result";
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GeneratePinsActionResult | null>(null);

  function toggleAllVisibleRows() {
    setSelectedIds(allVisibleSelected ? [] : [...visibleRowIds]);
  }

  function toggleRow(rowId: string) {
    setSelectedIds((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId],
    );
  }

  async function handleConfirmGenerate() {
    setPhase("loading");
    const actionResult = await generateActivationPins({
      communityId,
      queueIds: selectedIds,
    });
    setResult(actionResult);
    setPhase("result");
  }

  function handleCloseResult() {
    setResult(null);
    setPhase("idle");
    // Clear selection after generation so stale selected IDs don't linger
    setSelectedIds([]);
  }

  const canGenerate = selectedCount > 0 && !!communityId;

  return (
    <>
      {/* Confirmation overlay */}
      {phase === "confirming" && (
        <Overlay>
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[28px] bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">
              Generate activation PINs?
            </h3>
            <p className="text-sm leading-6 text-slate-600">
              This will generate activation PINs for{" "}
              <span className="font-semibold">{selectedCount}</span> selected
              prepared resident{selectedCount !== 1 ? "s" : ""}. It will{" "}
              <span className="font-semibold">not</span> create ENTRY users yet.
            </p>
            <p className="text-sm leading-6 text-slate-500">
              PINs will expire in 7 days and can be regenerated.
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPhase("idle")}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmGenerate}>
                Generate PINs
              </Button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Loading overlay */}
      {phase === "loading" && (
        <Overlay>
          <div className="rounded-[28px] bg-white px-8 py-6 shadow-xl">
            <p className="text-sm font-semibold text-slate-900">
              Generating PINs…
            </p>
          </div>
        </Overlay>
      )}

      {/* Result modal */}
      {phase === "result" && result !== null && (
        <ResultModal
          result={result}
          communityName={communityName}
          onClose={handleCloseResult}
        />
      )}

      <div className="space-y-4 rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Residents ready for activation
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Review prepared resident records and generate activation PINs.
            </p>
          </div>

          <div className="space-y-2 xl:max-w-lg">
            <div className="flex flex-wrap gap-2">
              {/* Functional: Generate PIN */}
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  disabled={!canGenerate || phase === "loading"}
                  onClick={() => setPhase("confirming")}
                  title={
                    !communityId
                      ? "Select a community before generating PINs."
                      : selectedCount === 0
                        ? "Select residents to generate PINs."
                        : "Generate activation PINs for selected residents."
                  }
                >
                  Generate PIN
                </Button>
              </div>

              {/* Placeholder actions */}
              {PLACEHOLDER_ACTIONS.map((label) => (
                <Button
                  key={label}
                  type="button"
                  variant="secondary"
                  disabled
                  title="Coming soon."
                >
                  {label}
                </Button>
              ))}
            </div>

            {!communityId && (
              <p className="text-xs leading-5 text-amber-700">
                Select a community before generating PINs.
              </p>
            )}

            {communityId && selectedCount === 0 && (
              <p className="text-xs leading-5 text-slate-500">
                Select residents above to enable Generate PIN.
              </p>
            )}

            {communityId && selectedCount > 0 && (
              <p className="text-xs leading-5 text-slate-500">
                {selectedCount} resident{selectedCount !== 1 ? "s" : ""}{" "}
                selected. Send email invite, Copy WhatsApp message, and Mark
                skipped are coming soon.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisibleRows}
                className="h-4 w-4 rounded border-slate-300 text-teal-600"
              />
              Select all visible rows
            </label>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {selectedCount} selected
            </span>
          </div>
          <p className="text-sm text-slate-600">
            {selectedCount > 0
              ? `${selectedCount} resident${selectedCount !== 1 ? "s" : ""} selected.`
              : "Select residents to prepare activation actions."}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1120px] divide-y divide-[var(--border)] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="w-12 px-3 py-3 font-semibold">
                  <span className="sr-only">Select row</span>
                </th>
                <th className="px-3 py-3 font-semibold">Unit</th>
                <th className="px-3 py-3 font-semibold">Resident</th>
                <th className="px-3 py-3 font-semibold">Phone</th>
                <th className="px-3 py-3 font-semibold">Email</th>
                <th className="px-3 py-3 font-semibold">Owner reference</th>
                <th className="px-3 py-3 font-semibold">Suggested username</th>
                <th className="px-3 py-3 font-semibold">Method</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Last error</th>
                <th className="px-3 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-white text-slate-700">
              {rows.map((row) => {
                const isSelected = selectedIds.includes(row.id);

                return (
                  <tr
                    key={row.id}
                    className={isSelected ? "bg-teal-50/40" : undefined}
                  >
                    <td className="px-3 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(row.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600"
                      />
                    </td>
                    <td className="max-w-[10rem] px-3 py-3 align-top font-medium text-slate-900">
                      <span className="block truncate" title={row.unit}>
                        {row.unit}
                      </span>
                    </td>
                    <td className="max-w-[12rem] px-3 py-3 align-top">
                      <span className="block truncate" title={row.resident}>
                        {row.resident}
                      </span>
                    </td>
                    <td className="max-w-[10rem] px-3 py-3 align-top">
                      <span className="block truncate" title={row.phone}>
                        {row.phone}
                      </span>
                    </td>
                    <td className="max-w-[16rem] px-3 py-3 align-top">
                      <span className="block truncate" title={row.email}>
                        {row.email}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">{row.ownerReference}</td>
                    <td className="max-w-[10rem] px-3 py-3 align-top">
                      <span
                        className="block truncate"
                        title={row.suggestedUsername}
                      >
                        {row.suggestedUsername}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <Badge tone={getMethodTone(row.method)}>
                        {getMethodLabel(row.method)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <Badge tone={getStatusTone(row.status)}>
                        {getStatusLabel(row.status)}
                      </Badge>
                    </td>
                    <td className="max-w-[14rem] px-3 py-3 align-top">
                      <span className="block truncate" title={row.lastError}>
                        {row.lastError}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">
                      {row.createdAt}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
