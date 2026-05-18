"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ActivationQueueRow } from "@/features/entry/activation/actions";
import { createActivatedUsers } from "@/features/entry/activation/createUserActions";
import type {
  CreateActivatedUserItem,
  CreateActivatedUsersActionResult,
} from "@/features/entry/activation/createUserActions";
import { generateActivationPins } from "@/features/entry/activation/pinActions";
import type {
  GeneratePinItem,
  GeneratePinsActionResult,
} from "@/features/entry/activation/pinActions";
import { sendActivationEmails } from "@/features/entry/activation/emailActions";
import type { SendEmailInviteResult } from "@/features/entry/activation/emailActions";

type ActivationQueueTableProps = {
  communityId: string;
  communityName: string;
  rows: ActivationQueueRow[];
};

const TABLE_STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Invited", value: "invited" },
  { label: "PIN Generated", value: "pin_generated" },
  { label: "Activated", value: "activated" },
  { label: "Skipped", value: "skipped" },
  { label: "Error", value: "failed" },
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

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "R";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function buildWhatsAppMessage(item: GeneratePinItem, communityName: string) {
  const username = item.suggested_username
    ? item.suggested_username
    : "Se confirmara durante activacion";

  const lines = [
    `Hola ${item.resident_name ?? "residente"}, tu activacion de ENTRY esta lista.`,
    "",
  ];

  if (communityName) {
    lines.push(`Comunidad: ${communityName}`);
  }
  lines.push(`Unidad: ${item.unit_label ?? "-"}`);
  lines.push(`Usuario: ${username}`);
  lines.push(`PIN de activacion: ${item.pin ?? "-"}`);
  lines.push("");
  lines.push('Abri la app ENTRY y selecciona "Activar cuenta".');

  return lines.join("\n");
}

function buildCreatedUserMessage(
  item: CreateActivatedUserItem,
  communityName: string,
) {
  const identity =
    item.login_identity ||
    item.suggested_username ||
    item.email ||
    "Se confirmara al iniciar sesion";

  const lines = [
    `Hola ${item.resident_name ?? "residente"}, tu cuenta ENTRY ya fue creada.`,
    "",
  ];

  if (communityName) {
    lines.push(`Comunidad: ${communityName}`);
  }

  lines.push(`Unidad: ${item.unit_label ?? "-"}`);
  lines.push(`Usuario: ${identity}`);
  lines.push(`Contrasena temporal: ${item.temporary_password ?? "-"}`);
  lines.push("");
  lines.push("Inicia sesion y cambia tu contrasena lo antes posible.");

  return lines.join("\n");
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      {children}
    </div>
  );
}

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
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-rose-400/20 bg-[var(--surface-elevated)] p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white">PIN generation failed</h3>
          <p className="text-sm text-[var(--text-muted)]">{result.error}</p>
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
  const isAllFailed = data.generated_count === 0 && data.failed_count > 0;

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
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl">
        <div className="flex-shrink-0 border-b border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white">PIN generation results</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            <Badge tone="success">{data.generated_count} generated</Badge>
            {data.skipped_count > 0 ? (
              <Badge tone="default">{data.skipped_count} skipped</Badge>
            ) : null}
            {data.failed_count > 0 ? (
              <Badge tone="danger">{data.failed_count} failed</Badge>
            ) : null}
          </div>

          {isAllFailed ? (
            <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-rose-200">
                All selected rows failed. Check that the residents are in a valid
                state and try again.
              </p>
            </div>
          ) : null}

          {isPartialFailure && !isAllFailed ? (
            <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-amber-100">
                {data.failed_count} row{data.failed_count !== 1 ? "s" : ""} failed.
                PINs were generated for the rest.
              </p>
            </div>
          ) : null}

          {generatedItems.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-violet-100">
                Save or copy these PINs now. For security, this screen may not show
                them again after you close it.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {generatedItems.length > 0 ? (
            <div className="space-y-3">
              {generatedItems.map((item) => (
                <div
                  key={item.queue_id}
                  className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-white">
                        {item.resident_name ?? "Unnamed resident"}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {item.unit_label ?? "-"}
                        {item.email ? ` · ${item.email}` : ""}
                        {item.phone ? ` · ${item.phone}` : ""}
                      </p>
                      {item.suggested_username ? (
                        <p className="text-xs text-[var(--text-muted)]">
                          Username:{" "}
                          <span className="font-medium text-slate-200">
                            {item.suggested_username}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      <div className="rounded-xl border border-violet-400/20 bg-[rgba(9,12,24,0.72)] px-4 py-2 text-center">
                        <p className="text-xs font-medium text-[var(--text-muted)]">
                          Activation PIN
                        </p>
                        <p className="font-mono text-xl font-bold tracking-widest text-violet-200">
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
          ) : null}

          {otherItems.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Skipped / failed
              </p>
              {otherItems.map((item) => (
                <div
                  key={item.queue_id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[rgba(9,12,24,0.56)] px-4 py-3 text-sm"
                >
                  <span className="text-slate-200">
                    {item.resident_name ?? item.queue_id}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge tone={item.status === "failed" ? "danger" : "default"}>
                      {item.status}
                    </Badge>
                    {item.message ? (
                      <span className="text-xs text-[var(--text-muted)]">
                        {item.message}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex-shrink-0 flex flex-wrap items-center justify-end gap-3 border-t border-white/10 p-6">
          {generatedItems.length > 1 ? (
            <Button type="button" variant="secondary" onClick={copyAll}>
              {copiedAll ? "Copied!" : "Copy all messages"}
            </Button>
          ) : null}
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

function EmailResultModal({
  result,
  onClose,
}: {
  result: SendEmailInviteResult;
  onClose: () => void;
}) {
  if (!result.success) {
    return (
      <Overlay>
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-rose-400/20 bg-[var(--surface-elevated)] p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white">Email sending failed</h3>
          <p className="text-sm text-[var(--text-muted)]">{result.error}</p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </Overlay>
    );
  }

  const { data } = result;
  if (!data) return null;

  const sentItems = data.items.filter((i) => i.status === "sent");
  const failedItems = data.items.filter((i) => i.status === "failed");
  const skippedItems = data.items.filter((i) => i.status === "skipped");

  return (
    <Overlay>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl">
        <div className="flex-shrink-0 border-b border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white">Email invitation results</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            <Badge tone="success">{data.sent_count} sent</Badge>
            {data.skipped_count > 0 ? <Badge tone="default">{data.skipped_count} skipped</Badge> : null}
            {data.failed_count > 0 ? <Badge tone="danger">{data.failed_count} failed</Badge> : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {sentItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">Successfully Sent</p>
              {sentItems.map((item) => (
                <div key={item.queue_id} className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 py-3">
                  <p className="text-sm font-medium text-slate-200">{item.email}</p>
                </div>
              ))}
            </div>
          )}

          {(failedItems.length > 0 || skippedItems.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Failed / Skipped</p>
              {[...failedItems, ...skippedItems].map((item) => (
                <div key={item.queue_id} className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-[rgba(9,12,24,0.56)] px-4 py-3 text-sm">
                  <span className="text-slate-200 font-medium">{item.email}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={item.status === "failed" ? "danger" : "default"}>{item.status}</Badge>
                    <span className="text-xs text-[var(--text-muted)]">{item.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex justify-end border-t border-white/10 p-6">
          <Button type="button" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Overlay>
  );
}

function CreateUserResultModal({
  result,
  communityName,
  onClose,
}: {
  result: CreateActivatedUsersActionResult;
  communityName: string;
  onClose: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!result.success) {
    return (
      <Overlay>
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-rose-400/20 bg-[var(--surface-elevated)] p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white">User creation failed</h3>
          <p className="text-sm text-[var(--text-muted)]">{result.error}</p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </Overlay>
    );
  }

  const { data } = result;
  const activatedItems = data.items.filter((item) => item.status === "activated");
  const otherItems = data.items.filter((item) => item.status !== "activated");

  function copyCredentials(item: CreateActivatedUserItem) {
    const text = buildCreatedUserMessage(item, communityName);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(item.queue_id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function copyAll() {
    const text = activatedItems
      .map((item) => buildCreatedUserMessage(item, communityName))
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  }

  return (
    <Overlay>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl">
        <div className="flex-shrink-0 border-b border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white">Created user results</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            <Badge tone="success">{data.activated_count} created</Badge>
            {data.skipped_count > 0 ? (
              <Badge tone="default">{data.skipped_count} skipped</Badge>
            ) : null}
            {data.failed_count > 0 ? (
              <Badge tone="danger">{data.failed_count} failed</Badge>
            ) : null}
          </div>

          {activatedItems.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-violet-100">
                Save these temporary credentials now. They will not be shown again
                after you close this window.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activatedItems.length > 0 ? (
            <div className="space-y-3">
              {activatedItems.map((item) => (
                <div
                  key={item.queue_id}
                  className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-white">
                        {item.resident_name ?? "Unnamed resident"}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {item.unit_label ?? "-"}
                        {item.auth_type ? ` · ${item.auth_type}` : ""}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Login:{" "}
                        <span className="font-medium text-slate-200">
                          {item.login_identity ?? "Not available"}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      <div className="rounded-xl border border-violet-400/20 bg-[rgba(9,12,24,0.72)] px-4 py-2 text-center">
                        <p className="text-xs font-medium text-[var(--text-muted)]">
                          Temporary password
                        </p>
                        <p className="font-mono text-lg font-bold tracking-wide text-violet-200">
                          {item.temporary_password}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => copyCredentials(item)}
                      >
                        {copiedId === item.queue_id ? "Copied!" : "Copy credentials"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {otherItems.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Skipped / failed
              </p>
              {otherItems.map((item) => (
                <div
                  key={item.queue_id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[rgba(9,12,24,0.56)] px-4 py-3 text-sm"
                >
                  <span className="text-slate-200">
                    {item.resident_name ?? item.queue_id}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge tone={item.status === "failed" ? "danger" : "default"}>
                      {item.status}
                    </Badge>
                    {item.message ? (
                      <span className="text-xs text-[var(--text-muted)]">
                        {item.message}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex-shrink-0 flex flex-wrap items-center justify-end gap-3 border-t border-white/10 p-6">
          {activatedItems.length > 1 ? (
            <Button type="button" variant="secondary" onClick={copyAll}>
              {copiedAll ? "Copied!" : "Copy all credentials"}
            </Button>
          ) : null}
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

export function ActivationQueueTable({
  communityId,
  communityName,
  rows,
}: ActivationQueueTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeRowId, setActiveRowId] = useState<string | null>(rows[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesStatus =
        statusFilter === "all" ? true : row.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        row.unit.toLowerCase().includes(normalizedQuery) ||
        row.resident.toLowerCase().includes(normalizedQuery) ||
        row.email.toLowerCase().includes(normalizedQuery) ||
        row.phone.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [rows, searchQuery, statusFilter]);
  const visibleRowIds = useMemo(
    () => filteredRows.map((row) => row.id),
    [filteredRows],
  );
  const allVisibleSelected =
    visibleRowIds.length > 0 &&
    visibleRowIds.every((rowId) => selectedIds.includes(rowId));
  const selectedCount = selectedIds.length;
  const createUserTargetIds = selectedCount > 0 ? selectedIds : visibleRowIds;
  const createUserTargetCount = createUserTargetIds.length;
  const activeRow =
    filteredRows.find((row) => row.id === activeRowId) ??
    rows.find((row) => row.id === activeRowId) ??
    filteredRows[0] ??
    rows[0] ??
    null;

  type Phase =
    | "idle"
    | "confirming"
    | "loading"
    | "result"
    | "confirmingEmail"
    | "loadingEmail"
    | "emailResult"
    | "confirmingCreateUser"
    | "loadingCreateUser"
    | "createUserResult";
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GeneratePinsActionResult | null>(null);
  const [emailResult, setEmailResult] = useState<SendEmailInviteResult | null>(null);
  const [createUserResult, setCreateUserResult] =
    useState<CreateActivatedUsersActionResult | null>(null);

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

  async function handleConfirmSendEmail() {
    setPhase("loadingEmail");
    const actionResult = await sendActivationEmails({
      communityId,
      communityName,
      queueIds: selectedIds,
    });
    setEmailResult(actionResult);
    setPhase("emailResult");
  }

  async function handleConfirmCreateUser() {
    setPhase("loadingCreateUser");
    const actionResult = await createActivatedUsers({
      communityId,
      queueIds: createUserTargetIds,
    });
    setCreateUserResult(actionResult);
    setPhase("createUserResult");
  }

  function handleCloseResult() {
    setResult(null);
    setPhase("idle");
    setSelectedIds([]);
  }

  function handleCloseEmailResult() {
    setEmailResult(null);
    setPhase("idle");
    setSelectedIds([]);
  }

  function handleCloseCreateUserResult() {
    setCreateUserResult(null);
    setPhase("idle");
    setSelectedIds([]);
  }

  function focusRow(rowId: string) {
    setActiveRowId(rowId);
  }

  function runResidentEmail(rowId: string) {
    setSelectedIds([rowId]);
    setActiveRowId(rowId);
    setPhase("confirmingEmail");
  }

  function runResidentCreateUser(rowId: string) {
    setSelectedIds([rowId]);
    setActiveRowId(rowId);
    setPhase("confirmingCreateUser");
  }

  const canGenerate = selectedCount > 0 && !!communityId;
  const canCreateUsers = createUserTargetCount > 0 && !!communityId;

  const selectedRows = rows.filter((r) => selectedIds.includes(r.id));
  const allSelectedAreInvited =
    selectedRows.length > 0 && selectedRows.every((r) => r.status === "invited");
  const someSelectedAreInvited = selectedRows.some((r) => r.status === "invited");

  return (
    <>
      {phase === "confirming" ? (
        <Overlay>
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">
              Generate activation PINs?
            </h3>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              This will generate activation PINs for{" "}
              <span className="font-semibold text-slate-100">{selectedCount}</span>{" "}
              selected prepared resident{selectedCount !== 1 ? "s" : ""}. It will{" "}
              <span className="font-semibold text-slate-100">not</span> create
              ENTRY users yet.
            </p>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
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
      ) : null}

      {phase === "loading" ? (
        <Overlay>
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] px-8 py-6 shadow-xl">
            <p className="text-sm font-semibold text-white">Generating PINs...</p>
          </div>
        </Overlay>
      ) : null}

      {phase === "result" && result !== null ? (
        <ResultModal
          result={result}
          communityName={communityName}
          onClose={handleCloseResult}
        />
      ) : null}

      {phase === "confirmingEmail" ? (
        <Overlay>
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">
              {someSelectedAreInvited ? "Resend activation email?" : "Send email invites?"}
            </h3>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              {someSelectedAreInvited
                ? <>A new PIN will be generated and the activation email will be resent to <span className="font-semibold text-slate-100">{selectedCount}</span> selected resident(s). Any previous PIN will be replaced.</>
                : <>This will generate PINs and send invitation emails to <span className="font-semibold text-slate-100">{selectedCount}</span> selected resident(s) who have an email address.</>
              }
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPhase("idle")}>Cancel</Button>
              <Button type="button" onClick={handleConfirmSendEmail}>
                {someSelectedAreInvited ? "Resend" : "Send Emails"}
              </Button>
            </div>
          </div>
        </Overlay>
      ) : null}

      {phase === "loadingEmail" ? (
        <Overlay>
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] px-8 py-6 shadow-xl">
            <p className="text-sm font-semibold text-white">Sending emails...</p>
          </div>
        </Overlay>
      ) : null}

      {phase === "emailResult" && emailResult !== null ? (
        <EmailResultModal result={emailResult} onClose={handleCloseEmailResult} />
      ) : null}

      {phase === "confirmingCreateUser" ? (
        <Overlay>
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">
              Create active ENTRY users?
            </h3>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              This will immediately create active ENTRY users for{" "}
              <span className="font-semibold text-slate-100">
                {createUserTargetCount}
              </span>{" "}
              resident{createUserTargetCount !== 1 ? "s" : ""} and generate a
              temporary password for each one.
            </p>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Use this when you need to finish activation from the console instead
              of waiting for the resident to complete it.
            </p>
            {selectedCount === 0 ? (
              <p className="text-sm leading-6 text-amber-200">
                No rows are selected, so this will use all visible residents.
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPhase("idle")}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmCreateUser}>
                Create users
              </Button>
            </div>
          </div>
        </Overlay>
      ) : null}

      {phase === "loadingCreateUser" ? (
        <Overlay>
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] px-8 py-6 shadow-xl">
            <p className="text-sm font-semibold text-white">Creating users...</p>
          </div>
        </Overlay>
      ) : null}

      {phase === "createUserResult" && createUserResult !== null ? (
        <CreateUserResultModal
          result={createUserResult}
          communityName={communityName}
          onClose={handleCloseCreateUserResult}
        />
      ) : null}

      <section className="space-y-4 rounded-[28px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(16,20,29,0.94),rgba(12,17,25,0.9))] p-4 shadow-[0_18px_50px_rgba(2,6,23,0.18)] backdrop-blur">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">Prepared residents</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Review prepared residents and run controlled activation actions.
          </p>
        </div>

        <div
          className={[
            "grid gap-4",
            activeRow ? "xl:h-[calc(100vh-23rem)] xl:grid-cols-[minmax(0,1fr)_352px]" : "",
          ].join(" ")}
        >
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">

        <div className="rounded-[22px] border border-white/8 bg-[rgba(12,17,25,0.58)] p-3.5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-200">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisibleRows}
                  className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-[var(--primary)]"
                />
                Select all visible rows
              </label>
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-slate-200">
                {selectedCount} selected
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Select one or more residents to enable activation actions.
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!canGenerate || (phase !== "idle" && phase !== "confirming")}
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

            <Button
              type="button"
              variant="secondary"
              disabled={
                !canCreateUsers ||
                (phase !== "idle" && phase !== "confirmingCreateUser")
              }
              onClick={() => setPhase("confirmingCreateUser")}
              title={
                !communityId
                  ? "Select a community before creating users."
                  : createUserTargetCount === 0
                    ? "No residents are visible to create users."
                    : selectedCount === 0
                      ? "Create users for all visible residents."
                      : "Create active users directly from selected residents."
              }
            >
              Create user
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={!canGenerate || (phase !== "idle" && phase !== "confirmingEmail")}
              onClick={() => setPhase("confirmingEmail")}
              title={
                !communityId
                  ? "Select a community before sending emails."
                  : selectedCount === 0
                    ? "Select residents to send emails."
                    : allSelectedAreInvited
                      ? "Resend activation email to selected residents."
                      : "Send email invites with activation PINs."
              }
            >
              {allSelectedAreInvited ? "Resend email" : "Send email invite"}
            </Button>
          </div>

          <div className="mt-2.5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-3 text-xs leading-5">
              {!communityId ? (
                <p className="text-amber-200">
                  Select a community before generating PINs.
                </p>
              ) : null}

              {communityId && selectedCount === 0 ? (
                <p className="text-[var(--text-muted)]">
                  Generate PIN and email require selection. Create user can use all
                  visible residents even if none are selected.
                </p>
              ) : null}

              {communityId && selectedCount > 0 ? (
                <p className="text-[var(--text-muted)]">
                  {selectedCount} resident{selectedCount !== 1 ? "s" : ""} selected.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search unit or resident"
                  className="h-11 w-full min-w-[16rem] rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/50"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 min-w-[9rem] rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 text-sm text-white outline-none transition focus:border-violet-400/50"
              >
                {TABLE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-white/8 bg-[rgba(9,12,24,0.36)]">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-[1040px] w-full table-fixed divide-y divide-white/8 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[rgba(9,12,24,0.94)] text-slate-300 backdrop-blur">
                <tr>
                  <th className="w-12 px-3 py-3 font-semibold">
                    <span className="sr-only">Select row</span>
                  </th>
                  <th className="w-[15%] px-3 py-3 font-semibold">Unit</th>
                  <th className="w-[16%] px-3 py-3 font-semibold">Resident</th>
                  <th className="w-[19%] px-3 py-3 font-semibold">Contact</th>
                  <th className="w-[15%] px-3 py-3 font-semibold">Username</th>
                  <th className="w-[13%] px-3 py-3 font-semibold">Method</th>
                  <th className="w-[12%] px-3 py-3 font-semibold">Status</th>
                  <th className="w-[18%] px-3 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 bg-[var(--surface)] text-slate-200">
                {filteredRows.map((row) => {
                  const isSelected = selectedIds.includes(row.id);
                  const isActive = activeRow?.id === row.id;

                  return (
                    <tr
                      key={row.id}
                      className={[
                        "cursor-pointer transition",
                        isActive
                          ? "bg-violet-500/10 ring-1 ring-inset ring-violet-400/30"
                          : isSelected
                            ? "bg-violet-500/8"
                            : "hover:bg-white/4",
                      ].join(" ")}
                      onClick={() => focusRow(row.id)}
                    >
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(row.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-900 text-[var(--primary)]"
                        />
                      </td>
                      <td className="px-3 py-3 align-top font-medium text-white">
                        <span className="block truncate" title={row.unit}>
                          {row.unit}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">
                          {row.ownerReference}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="block truncate text-white" title={row.resident}>
                          {row.resident}
                        </span>
                        {row.lastError !== "â€”" ? (
                          <span
                            className="mt-1 block truncate text-xs text-rose-200"
                            title={row.lastError}
                          >
                            {row.lastError}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="block truncate" title={row.phone}>
                          {row.phone}
                        </span>
                        <span
                          className="mt-1 block truncate text-[var(--text-muted)]"
                          title={row.email}
                        >
                          {row.email}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="block truncate" title={row.suggestedUsername}>
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
                      <td className="whitespace-nowrap px-3 py-3 align-top text-[var(--text-muted)]">
                        {row.createdAt}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-white/8 px-4 py-3 text-sm text-[var(--text-muted)]">
            Showing 1 to {filteredRows.length} of {rows.length} residents
          </div>
        </div>

          </div>

          {activeRow ? (
            <aside className="flex h-full flex-col self-start overflow-hidden rounded-[24px] border border-white/8 bg-[rgba(12,17,25,0.72)] p-5 xl:sticky xl:top-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Resident actions</h3>
                <button
                  type="button"
                  onClick={() => setActiveRowId(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-[var(--text-muted)] transition hover:text-white"
                  aria-label="Close resident actions"
                >
                  ×
                </button>
              </div>

              <div className="mt-6 flex items-start gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,rgba(109,99,255,0.22),rgba(65,50,170,0.3))] text-xl font-semibold text-violet-100">
                  {getInitials(activeRow.resident)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-white">{activeRow.resident}</p>
                    <Badge tone={getStatusTone(activeRow.status)}>
                      {getStatusLabel(activeRow.status)}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm text-[var(--text-muted)]">{activeRow.unit}</p>
                  <p className="mt-3 text-sm text-slate-200">{activeRow.phone}</p>
                  <p className="mt-1.5 text-sm text-[var(--text-muted)]">{activeRow.email}</p>
                </div>
              </div>

              <div className="mt-6 rounded-[20px] border border-white/8 bg-[var(--surface-strong)] p-5">
                <h4 className="text-sm font-semibold text-white">Resident summary</h4>
                <div className="mt-5 space-y-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">Username</span>
                    <span className="text-slate-200">{activeRow.suggestedUsername}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">Method</span>
                    <span className="text-slate-200">{getMethodLabel(activeRow.method)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">Created</span>
                    <span className="text-slate-200">{activeRow.createdAt}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-semibold text-white">Available actions</h4>

                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-between rounded-[18px] border border-white/8 bg-[var(--surface-strong)] px-4 py-5 text-left text-sm text-[var(--text-muted)]"
                  title="Coming soon."
                >
                  <div>
                    <p className="font-semibold text-white">Send info to WhatsApp</p>
                    <p className="mt-1 text-[var(--text-muted)]">
                      Send credential info and community access details via WhatsApp.
                    </p>
                  </div>
                  <span>›</span>
                </button>

                <button
                  type="button"
                  onClick={() => runResidentEmail(activeRow.id)}
                  disabled={!canGenerate || phase !== "idle"}
                  className="flex w-full items-center justify-between rounded-[18px] border border-white/8 bg-[var(--surface-strong)] px-4 py-5 text-left text-sm transition hover:border-violet-400/20"
                >
                  <div>
                    <p className="font-semibold text-white">Send email invite</p>
                    <p className="mt-1 text-[var(--text-muted)]">
                      Send an email invite with access instructions.
                    </p>
                  </div>
                  <span className="text-[var(--text-muted)]">›</span>
                </button>

                <button
                  type="button"
                  onClick={() => runResidentCreateUser(activeRow.id)}
                  disabled={!communityId || phase !== "idle"}
                  className="flex w-full items-center justify-between rounded-[18px] border border-white/8 bg-[var(--surface-strong)] px-4 py-5 text-left text-sm transition hover:border-violet-400/20"
                >
                  <div>
                    <p className="font-semibold text-white">Create user</p>
                    <p className="mt-1 text-[var(--text-muted)]">
                      Create the resident user and activate access.
                    </p>
                  </div>
                  <span className="text-[var(--text-muted)]">›</span>
                </button>
              </div>

              <p className="mt-auto pt-6 text-xs leading-5 text-[var(--text-muted)]">
                PINs are temporary 7-day credentials and will expire automatically.
              </p>
            </aside>
          ) : null}
        </div>
      </section>
    </>
  );
}
