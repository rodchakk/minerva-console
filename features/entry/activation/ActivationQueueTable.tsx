"use client";

import {
  CheckCircle2,
  Clock3,
  KeyRound,
  Mail,
  Pencil,
  Search,
  Send,
  TriangleAlert,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ActivationQueueRow } from "@/features/entry/activation/actions";
import { createActivatedUsers } from "@/features/entry/activation/createUserActions";
import {
  ResidentAccessModePicker,
  type ResidentAccessMode,
} from "@/features/entry/activation/ResidentAccessModePicker";
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
import { updateActivationEmail } from "@/features/entry/activation/emailEditActions";
import type { UpdateActivationEmailResult } from "@/features/entry/activation/emailEditActions";
import { updateActivationPhone } from "@/features/entry/activation/phoneEditActions";
import type { UpdateActivationPhoneResult } from "@/features/entry/activation/phoneEditActions";

type ActivationQueueTableProps = {
  communityId: string;
  communityName: string;
  rows: ActivationQueueRow[];
};



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

function EditActivationEmailModal({
  communityId,
  row,
  onClose,
}: {
  communityId: string;
  row: ActivationQueueRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(row.email === "—" ? "" : row.email);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<UpdateActivationEmailResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || saving) {
      return;
    }

    setSaving(true);
    const actionResult = await updateActivationEmail({
      communityId,
      queueId: row.id,
      email,
    });
    setResult(actionResult);
    setSaving(false);

    if (actionResult.success) {
      router.refresh();
    }
  }

  if (result?.success) {
    return (
      <Overlay>
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-emerald-400/20 bg-[var(--surface-elevated)] p-6 shadow-xl">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
              <CheckCircle2 className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {result.data.changed ? "Email updated" : "Email unchanged"}
              </h3>
              <p className="mt-1 break-all text-sm text-slate-200">
                {result.data.email}
              </p>
            </div>
          </div>
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            {result.data.changed
              ? "Previous activation credentials were invalidated. This resident is back in Pending and is ready for a new invitation."
              : "This is already the current activation email. No activation credentials or queue state were changed."}
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl"
      >
        <div>
          <h3 className="text-lg font-semibold text-white">Change activation email</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
            Correct the email used for this resident&apos;s pre-activation flow.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Current email
          </p>
          <p className="mt-1 break-all text-sm text-slate-200">{row.email}</p>
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold text-slate-200">New email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (result && !result.success) {
                setResult(null);
              }
            }}
            autoComplete="off"
            autoFocus
            required
            disabled={saving}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/15 disabled:opacity-60"
            placeholder="resident@example.com"
          />
        </label>

        <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-3 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
          <p className="text-xs leading-5 text-amber-100/80">
            Changing this email invalidates any current activation PIN and resets
            this resident to Pending. Send a new invitation afterward.
          </p>
        </div>

        {result && !result.success ? (
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/[0.07] px-3 py-3 text-xs leading-5 text-rose-100">
            {result.error}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !email.trim()}>
            {saving ? "Updating..." : "Update email"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

function EditActivationPhoneModal({
  communityId,
  row,
  onClose,
}: {
  communityId: string;
  row: ActivationQueueRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(row.phone === "—" ? "" : row.phone);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<UpdateActivationPhoneResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!phone.trim() || saving) {
      return;
    }

    setSaving(true);
    const actionResult = await updateActivationPhone({
      communityId,
      queueId: row.id,
      phone,
    });
    setResult(actionResult);
    setSaving(false);

    if (actionResult.success) {
      router.refresh();
    }
  }

  if (result?.success) {
    return (
      <Overlay>
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-emerald-400/20 bg-[var(--surface-elevated)] p-6 shadow-xl">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
              <CheckCircle2 className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {result.data.changed ? "Phone updated" : "Phone unchanged"}
              </h3>
              <p className="mt-1 break-all text-sm text-slate-200">
                {result.data.phone}
              </p>
            </div>
          </div>
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            {!result.data.changed
              ? "This is already the current activation phone. No queue state was changed."
              : result.data.activation_reset
                ? "The previous phone activation credential was invalidated. This resident is back in Pending and needs a new PIN."
                : "The phone number was updated without changing the resident's existing email activation state."}
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl"
      >
        <div>
          <h3 className="text-lg font-semibold text-white">Change activation phone</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
            Correct the phone number that will be stored for this resident.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Current phone
          </p>
          <p className="mt-1 break-all text-sm text-slate-200">{row.phone}</p>
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold text-slate-200">New phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              if (result && !result.success) {
                setResult(null);
              }
            }}
            autoComplete="off"
            autoFocus
            required
            disabled={saving}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/15 disabled:opacity-60"
            placeholder="+504 9999-9999"
          />
        </label>

        {row.method === "phone_pin" ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-3 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
            <p className="text-xs leading-5 text-amber-100/80">
              This resident uses Phone PIN activation. Changing the number will
              invalidate the current PIN and return the resident to Pending.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 text-xs leading-5 text-[var(--text-muted)]">
            This resident uses {getMethodLabel(row.method)} activation. Changing
            the phone will not invalidate an email activation already sent.
          </div>
        )}

        {result && !result.success ? (
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/[0.07] px-3 py-3 text-xs leading-5 text-rose-100">
            {result.error}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !phone.trim()}>
            {saving ? "Updating..." : "Update phone"}
          </Button>
        </div>
      </form>
    </Overlay>
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
            {!data.metadata_persisted ? <Badge tone="warning">metadata warning</Badge> : null}
          </div>
          {data.warning ? (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {data.warning}
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {sentItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">Successfully Sent</p>
              {sentItems.map((item) => (
                <div key={item.queue_id} className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 py-3">
                  <p className="text-sm font-medium text-slate-200">{item.email}</p>
                  {item.message ? (
                    <p className="mt-1 text-xs text-amber-100">{item.message}</p>
                  ) : null}
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

type QueueView =
  | "all"
  | "ready"
  | "pending_pin"
  | "pending_invite"
  | "awaiting_activation"
  | "activated"
  | "errors";

function matchesQueueView(row: ActivationQueueRow, view: QueueView) {
  switch (view) {
    case "ready":
      return ["pending", "pin_generated", "invited"].includes(row.status);
    case "pending_pin":
      return row.status === "pending";
    case "pending_invite":
      return row.status === "pin_generated";
    case "awaiting_activation":
      return row.status === "invited";
    case "activated":
      return row.status === "activated";
    case "errors":
      return row.status === "failed";
    default:
      return true;
  }
}

function getQueueViewLabel(view: QueueView) {
  switch (view) {
    case "ready":
      return "Ready";
    case "pending_pin":
      return "Pending PIN";
    case "pending_invite":
      return "Pending invite";
    case "awaiting_activation":
      return "Awaiting activation";
    case "activated":
      return "Activated";
    case "errors":
      return "Errors";
    default:
      return "All";
  }
}

function getActivationStage(row: ActivationQueueRow) {
  const status = row.status;
  return [
    { done: true, label: "Prepared" },
    {
      done: ["pin_generated", "invited", "activated"].includes(status),
      label: "PIN ready",
    },
    {
      done: ["invited", "activated"].includes(status),
      label: "Invite sent",
    },
    { done: status === "activated", label: "Activated" },
  ];
}

function hasValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && !["—", "-", "unknown", "not configured"].includes(normalized);
}

function getQueueBlockers(row: ActivationQueueRow) {
  const blockers: string[] = [];

  if (row.status === "failed") {
    blockers.push(
      hasValue(row.lastError)
        ? row.lastError
        : "This queue row is in an error state.",
    );
  }

  if (row.method === "not_configured") {
    blockers.push("Activation method is not configured.");
  }

  if (row.method === "email" && !hasValue(row.email)) {
    blockers.push("Email address is required for email activation.");
  }

  if (row.method === "phone_pin" && !hasValue(row.phone)) {
    blockers.push("Phone number is required for phone PIN activation.");
  }

  return Array.from(new Set(blockers));
}

function QueueMetric({
  active,
  description,
  icon: Icon,
  label,
  onClick,
  tone,
  value,
}: {
  active: boolean;
  description: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone: "violet" | "amber" | "blue" | "emerald" | "rose";
  value: number;
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-500/12 text-amber-300 ring-amber-400/20"
      : tone === "blue"
        ? "bg-sky-500/12 text-sky-300 ring-sky-400/20"
        : tone === "emerald"
          ? "bg-emerald-500/12 text-emerald-300 ring-emerald-400/20"
          : tone === "rose"
            ? "bg-rose-500/12 text-rose-300 ring-rose-400/20"
            : "bg-violet-500/12 text-violet-200 ring-violet-400/20";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-0 rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-violet-400/45 bg-violet-500/[0.08] ring-1 ring-inset ring-violet-400/10"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-white/15 hover:bg-white/[0.025]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-inset ${toneClass}`}>
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold leading-none text-white">{value}</p>
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-[var(--text-muted)]">
            {description}
          </p>
        </div>
      </div>
    </button>
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
  const [queueView, setQueueView] = useState<QueueView>("all");
  const [emailEditorRowId, setEmailEditorRowId] = useState<string | null>(null);
  const [phoneEditorRowId, setPhoneEditorRowId] = useState<string | null>(null);

  const queueCounts = useMemo(
    () => ({
      activated: rows.filter((row) => matchesQueueView(row, "activated")).length,
      all: rows.length,
      errors: rows.filter((row) => matchesQueueView(row, "errors")).length,
      awaiting_activation: rows.filter((row) =>
        matchesQueueView(row, "awaiting_activation"),
      ).length,
      pending_invite: rows.filter((row) =>
        matchesQueueView(row, "pending_invite"),
      ).length,
      pending_pin: rows.filter((row) => matchesQueueView(row, "pending_pin")).length,
      ready: rows.filter((row) => matchesQueueView(row, "ready")).length,
    }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesView = matchesQueueView(row, queueView);
      const matchesQuery =
        !normalizedQuery ||
        row.unit.toLowerCase().includes(normalizedQuery) ||
        row.resident.toLowerCase().includes(normalizedQuery) ||
        row.email.toLowerCase().includes(normalizedQuery) ||
        row.phone.toLowerCase().includes(normalizedQuery) ||
        row.suggestedUsername.toLowerCase().includes(normalizedQuery);

      return matchesView && matchesQuery;
    });
  }, [queueView, rows, searchQuery]);

  const visibleRowIds = useMemo(
    () => filteredRows.map((row) => row.id),
    [filteredRows],
  );
  const allVisibleSelected =
    visibleRowIds.length > 0 &&
    visibleRowIds.every((rowId) => selectedIds.includes(rowId));
  const selectedCount = selectedIds.length;
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  const createUserTargetIds = selectedIds;
  const createUserTargetCount = selectedCount;
  const activeRow =
    filteredRows.find((row) => row.id === activeRowId) ??
    rows.find((row) => row.id === activeRowId) ??
    filteredRows[0] ??
    rows[0] ??
    null;
  const activeRowBlockers = activeRow ? getQueueBlockers(activeRow) : [];
  const emailEditorRow = emailEditorRowId
    ? rows.find((row) => row.id === emailEditorRowId) ?? null
    : null;
  const phoneEditorRow = phoneEditorRowId
    ? rows.find((row) => row.id === phoneEditorRowId) ?? null
    : null;
  const allSelectedAreInvited =
    selectedRows.length > 0 &&
    selectedRows.every((row) => row.status === "invited");
  const someSelectedAreInvited = selectedRows.some(
    (row) => row.status === "invited",
  );

  type Phase =
    | "idle"
    | "confirming"
    | "loading"
    | "result"
    | "confirmingEmail"
    | "loadingEmail"
    | "emailResult"
    | "choosingAccess"
    | "confirmingCreateUser"
    | "loadingCreateUser"
    | "createUserResult";
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GeneratePinsActionResult | null>(null);
  const [emailResult, setEmailResult] = useState<SendEmailInviteResult | null>(null);
  const [createUserResult, setCreateUserResult] =
    useState<CreateActivatedUsersActionResult | null>(null);
  const [accessMode, setAccessMode] = useState<ResidentAccessMode>("email");

  function toggleAllVisibleRows() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleRowIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleRowIds]));
    });
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

  function runResidentPin(rowId: string) {
    setSelectedIds([rowId]);
    setActiveRowId(rowId);
    setPhase("confirming");
  }

  function runResidentEmail(rowId: string) {
    if (selectedIds.length > 1) {
      setPhase("confirmingEmail");
      return;
    }

    setSelectedIds([rowId]);
    setActiveRowId(rowId);
    setPhase("confirmingEmail");
  }

  function runResidentCreateUser(rowId: string) {
    setSelectedIds([rowId]);
    setActiveRowId(rowId);
    setAccessMode("email");
    setPhase("choosingAccess");
  }

  function continueAccessChoice() {
    if (accessMode === "email") {
      setPhase("confirmingEmail");
      return;
    }

    if (accessMode === "pin") {
      setPhase("confirming");
      return;
    }

    setPhase("confirmingCreateUser");
  }

  const canGenerate = selectedCount > 0 && Boolean(communityId);
  const canCreateUsers = selectedCount > 0 && Boolean(communityId);
  const selectedEmailEligible =
    selectedRows.length > 0 &&
    selectedRows.every(
      (row) => row.method === "email" && hasValue(row.email) && row.status !== "activated",
    );
  const selectedQuickCreateEligible =
    selectedRows.length > 0 &&
    selectedRows.every((row) => !["activated", "skipped"].includes(row.status));

  return (
    <>
      {emailEditorRow ? (
        <EditActivationEmailModal
          communityId={communityId}
          row={emailEditorRow}
          onClose={() => setEmailEditorRowId(null)}
        />
      ) : null}

      {phoneEditorRow ? (
        <EditActivationPhoneModal
          communityId={communityId}
          row={phoneEditorRow}
          onClose={() => setPhoneEditorRowId(null)}
        />
      ) : null}

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
              <Button type="button" variant="secondary" onClick={() => setPhase("idle")}>
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
              {someSelectedAreInvited
                ? "Resend activation email?"
                : "Send email invites?"}
            </h3>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              {someSelectedAreInvited ? (
                <>
                  A new PIN will be generated and the activation email will be
                  resent to{" "}
                  <span className="font-semibold text-slate-100">
                    {selectedCount}
                  </span>{" "}
                  selected resident(s). Any previous PIN will be replaced.
                </>
              ) : (
                <>
                  This will generate PINs and send invitation emails to{" "}
                  <span className="font-semibold text-slate-100">
                    {selectedCount}
                  </span>{" "}
                  selected resident(s) who have an email address.
                </>
              )}
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPhase("idle")}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmSendEmail}>
                {someSelectedAreInvited ? "Resend" : "Send emails"}
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

      {phase === "choosingAccess" ? (
        <Overlay>
          <div className="flex w-full max-w-2xl flex-col gap-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
                ENTRY user creation
              </p>
              <h3 className="mt-1 text-xl font-semibold text-white">
                Create ENTRY user{selectedCount !== 1 ? "s" : ""}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Choose how you want to create the selected resident{selectedCount !== 1 ? "s" : ""}.
                This same standard is used across Minerva Console.
              </p>
            </div>
            <ResidentAccessModePicker
              value={accessMode}
              onChange={setAccessMode}
              disabled={{
                email: selectedEmailEligible
                  ? undefined
                  : "Email invitation requires every selected resident to have an email-based queue record and not already be activated.",
                quick: selectedQuickCreateEligible
                  ? undefined
                  : "Quick create is not available for already activated or skipped rows.",
              }}
            />
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPhase("idle")}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={continueAccessChoice}
                disabled={
                  (accessMode === "email" && !selectedEmailEligible) ||
                  (accessMode === "quick" && !selectedQuickCreateEligible)
                }
              >
                Continue
              </Button>
            </div>
          </div>
        </Overlay>
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
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPhase("idle")}>
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

      <section className="space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-500/12 text-violet-200 ring-1 ring-inset ring-violet-400/20">
              <Users className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                {selectedCount > 0
                  ? `${selectedCount} resident${selectedCount === 1 ? "" : "s"} selected`
                  : `${queueCounts.ready} residents still in the activation flow`}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {selectedCount > 0
                  ? "Bulk actions apply only to the selected residents."
                  : "Select residents below for PIN and invite actions."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={!canGenerate || phase !== "idle"}
              onClick={() => setPhase("confirming")}
              className="gap-2"
            >
              <KeyRound className="size-4" aria-hidden />
              Generate PIN
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!canCreateUsers || phase !== "idle"}
              onClick={() => {
                setAccessMode("email");
                setPhase("choosingAccess");
              }}
              className="gap-2"
            >
              <UserPlus className="size-4" aria-hidden />
              Create user
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!canGenerate || phase !== "idle"}
              onClick={() => setPhase("confirmingEmail")}
              className="gap-2"
            >
              <Send className="size-4" aria-hidden />
              {selectedCount > 1
                ? `${allSelectedAreInvited ? "Resend" : "Send"} ${selectedCount} invites`
                : allSelectedAreInvited
                  ? "Resend invite"
                  : "Send invite"}
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <QueueMetric
            active={queueView === "ready"}
            description="Prepared residents still awaiting completion."
            icon={Users}
            label="Ready now"
            onClick={() => setQueueView("ready")}
            tone="violet"
            value={queueCounts.ready}
          />
          <QueueMetric
            active={queueView === "pending_pin"}
            description="Prepared and waiting for an activation PIN."
            icon={Clock3}
            label="Pending PIN"
            onClick={() => setQueueView("pending_pin")}
            tone="amber"
            value={queueCounts.pending_pin}
          />
          <QueueMetric
            active={queueView === "pending_invite"}
            description="PIN is ready, but the invitation has not been sent yet."
            icon={Mail}
            label="Pending invite"
            onClick={() => setQueueView("pending_invite")}
            tone="blue"
            value={queueCounts.pending_invite}
          />
          <QueueMetric
            active={queueView === "awaiting_activation"}
            description="Invitation sent; waiting for the resident to complete activation."
            icon={Send}
            label="Awaiting activation"
            onClick={() => setQueueView("awaiting_activation")}
            tone="violet"
            value={queueCounts.awaiting_activation}
          />
          <QueueMetric
            active={queueView === "activated"}
            description="Residents with completed account activation."
            icon={CheckCircle2}
            label="Activated"
            onClick={() => setQueueView("activated")}
            tone="emerald"
            value={queueCounts.activated}
          />
          <QueueMetric
            active={queueView === "errors"}
            description="Queue rows requiring operator attention."
            icon={TriangleAlert}
            label="Errors"
            onClick={() => setQueueView("errors")}
            tone="rose"
            value={queueCounts.errors}
          />
        </div>

        <div className="grid gap-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
          <button
            type="button"
            onClick={() => setQueueView(queueCounts.errors > 0 ? "errors" : "ready")}
            className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left ${
              queueCounts.errors > 0
                ? "border-rose-400/25 bg-rose-500/[0.07]"
                : "border-emerald-400/20 bg-emerald-500/[0.06]"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid size-9 shrink-0 place-items-center rounded-full ${
                queueCounts.errors > 0
                  ? "bg-rose-500/12 text-rose-300"
                  : "bg-emerald-500/12 text-emerald-300"
              }`}>
                {queueCounts.errors > 0 ? (
                  <TriangleAlert className="size-4" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${
                  queueCounts.errors > 0 ? "text-rose-100" : "text-emerald-100"
                }`}>
                  {queueCounts.errors > 0 ? "Needs attention" : "Queue checks clear"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {queueCounts.errors > 0
                    ? `${queueCounts.errors} resident${queueCounts.errors === 1 ? "" : "s"} currently have queue errors.`
                    : "No queue rows are currently reporting activation errors."}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">
              {queueCounts.errors > 0 ? "View errors" : "View ready"}
            </span>
          </button>

          <div className="flex items-center gap-3 rounded-xl border border-sky-400/15 bg-sky-500/[0.045] px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-500/10 text-sky-300">
              <KeyRound className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Activation tip</p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                Select multiple residents to generate PINs or send invites in one controlled batch.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:h-[clamp(34rem,calc(100dvh-24rem),52rem)] xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] xl:min-h-0">
            <div className="border-b border-[var(--border)] px-3 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex gap-1 overflow-x-auto pb-1" aria-label="Activation queue filters">
                  {(["all", "ready", "pending_pin", "pending_invite", "awaiting_activation", "activated", "errors"] as QueueView[]).map((view) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setQueueView(view)}
                      aria-pressed={queueView === view}
                      className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                        queueView === view
                          ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {getQueueViewLabel(view)}{" "}
                      <span className="ml-1 opacity-70">{queueCounts[view]}</span>
                    </button>
                  ))}
                </div>

                <label className="relative block xl:w-[20rem]">
                  <span className="sr-only">Search activation queue</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search resident, unit or contact..."
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/45"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-200">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisibleRows}
                    className="size-4 accent-violet-500"
                  />
                  Select all visible
                </label>
                <p className="text-xs text-[var(--text-muted)]">
                  {selectedCount > 0
                    ? `${selectedCount} selected`
                    : `${filteredRows.length} visible residents`}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable]">
              <table className="w-full min-w-[1180px] table-fixed border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-white/[0.08] bg-[rgba(12,17,25,0.96)] text-[var(--text-muted)] backdrop-blur">
                  <tr>
                    <th className="w-11 px-3 py-2.5">
                      <span className="sr-only">Select row</span>
                    </th>
                    <th className="w-[13%] px-3 py-2.5 font-semibold">Unit</th>
                    <th className="w-[18%] px-3 py-2.5 font-semibold">Resident</th>
                    <th className="w-[21%] px-3 py-2.5 font-semibold">Contact</th>
                    <th className="w-[15%] px-3 py-2.5 font-semibold">Username</th>
                    <th className="w-[11%] px-3 py-2.5 font-semibold">Method</th>
                    <th className="w-[11%] px-3 py-2.5 font-semibold">Status</th>
                    <th className="w-[15%] px-3 py-2.5 font-semibold">Last activation</th>
                    <th className="w-[15%] px-3 py-2.5 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07] text-slate-200">
                  {filteredRows.map((row) => {
                    const isSelected = selectedIds.includes(row.id);
                    const isActive = activeRow?.id === row.id;

                    return (
                      <tr
                        key={row.id}
                        onClick={() => focusRow(row.id)}
                        className={`cursor-pointer transition ${
                          isActive
                            ? "bg-violet-500/[0.10] ring-1 ring-inset ring-violet-400/25"
                            : isSelected
                              ? "bg-violet-500/[0.055]"
                              : "hover:bg-white/[0.025]"
                        }`}
                      >
                        <td className="px-3 py-2.5 align-top">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(row.id)}
                            onClick={(event) => event.stopPropagation()}
                            className="size-4 accent-violet-500"
                            aria-label={`Select ${row.resident}`}
                          />
                        </td>
                        <td className="px-3 py-2.5 align-top font-medium text-white">
                          <span className="block truncate" title={row.unit}>{row.unit}</span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span className="block truncate font-medium text-white" title={row.resident}>
                            {row.resident}
                          </span>
                          {hasValue(row.lastError) ? (
                            <span className="mt-1 block truncate text-[10px] text-rose-200" title={row.lastError}>
                              {row.lastError}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span className="block truncate" title={row.phone}>{row.phone}</span>
                          <span className="mt-1 block truncate text-[var(--text-muted)]" title={row.email}>{row.email}</span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span className="block truncate" title={row.suggestedUsername}>{row.suggestedUsername}</span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <Badge tone={getMethodTone(row.method)}>{getMethodLabel(row.method)}</Badge>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <Badge tone={getStatusTone(row.status)}>{getStatusLabel(row.status)}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top">
                          <span className="block text-slate-200">{row.lastActivationAt}</span>
                          {row.lastActivationChannel !== "—" ? (
                            <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                              {row.lastActivationChannel}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top text-[var(--text-muted)]">
                          {row.createdAt}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-16 text-center text-sm text-[var(--text-muted)]">
                        No residents match this queue view.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 text-xs text-[var(--text-muted)]">
              <span>
                Showing {filteredRows.length} of {rows.length} residents
              </span>
              <span>{selectedCount} selected</span>
            </div>
          </section>

          <aside className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] xl:min-h-0">
            {!activeRow ? (
              <div className="grid flex-1 place-items-center px-6 text-center">
                <div>
                  <Users className="mx-auto size-6 text-violet-300" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-white">Select a resident</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    Open a queue row to review activation status and available actions.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-violet-500/15 text-sm font-semibold text-violet-100 ring-1 ring-inset ring-violet-400/20">
                      {getInitials(activeRow.resident)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">{activeRow.resident}</p>
                        <Badge tone={getStatusTone(activeRow.status)}>{getStatusLabel(activeRow.status)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{activeRow.unit}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveRowId(null)}
                    className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-white/5 hover:text-white"
                    aria-label="Close resident details"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable]">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Activation progress
                    </p>
                    <div className="mt-3 grid grid-cols-4 gap-1.5">
                      {getActivationStage(activeRow).map((stage, index) => (
                        <div key={stage.label} className="min-w-0">
                          <div className="flex items-center">
                            <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                              stage.done
                                ? "bg-violet-500 text-white"
                                : "bg-white/[0.06] text-[var(--text-muted)] ring-1 ring-inset ring-white/10"
                            }`}>
                              {stage.done ? "✓" : index + 1}
                            </span>
                            {index < 3 ? (
                              <span className={`h-px flex-1 ${
                                stage.done ? "bg-violet-400/55" : "bg-white/10"
                              }`} />
                            ) : null}
                          </div>
                          <p className={`mt-1.5 truncate text-[9px] ${
                            stage.done ? "text-slate-200" : "text-[var(--text-muted)]"
                          }`}>
                            {stage.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-3.5">
                    <p className="text-xs font-semibold text-white">Details</p>
                    <dl className="mt-3 space-y-2.5 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-[var(--text-muted)]">Unit</dt>
                        <dd className="text-right text-slate-200">{activeRow.unit}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-[var(--text-muted)]">Username</dt>
                        <dd className="max-w-[60%] truncate text-right text-slate-200" title={activeRow.suggestedUsername}>
                          {activeRow.suggestedUsername}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-[var(--text-muted)]">Method</dt>
                        <dd className="text-right text-slate-200">{getMethodLabel(activeRow.method)}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-[var(--text-muted)]">Phone</dt>
                        <dd className="max-w-[70%] text-right text-slate-200">
                          <span className="block break-all">{activeRow.phone}</span>
                          {!["activated", "skipped"].includes(activeRow.status) ? (
                            <button
                              type="button"
                              onClick={() => setPhoneEditorRowId(activeRow.id)}
                              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-300 transition hover:text-violet-200"
                            >
                              <Pencil className="size-3" aria-hidden />
                              Edit phone
                            </button>
                          ) : null}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-[var(--text-muted)]">Email</dt>
                        <dd className="max-w-[70%] text-right text-slate-200">
                          <span className="block break-all">{activeRow.email}</span>
                          {!["activated", "skipped"].includes(activeRow.status) ? (
                            <button
                              type="button"
                              onClick={() => setEmailEditorRowId(activeRow.id)}
                              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-300 transition hover:text-violet-200"
                            >
                              <Pencil className="size-3" aria-hidden />
                              Edit email
                            </button>
                          ) : null}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-[var(--text-muted)]">Last email sent</dt>
                        <dd className="text-right text-slate-200">{activeRow.inviteSentAt}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-[var(--text-muted)]">Last PIN generated</dt>
                        <dd className="text-right text-slate-200">{activeRow.lastPinGeneratedAt}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-[var(--text-muted)]">Created</dt>
                        <dd className="text-right text-slate-200">{activeRow.createdAt}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Queue checks
                    </p>
                    {activeRowBlockers.length === 0 ? (
                      <div className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/[0.07] px-3 py-3">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
                        <div>
                          <p className="text-xs font-semibold text-emerald-100">No blockers detected</p>
                          <p className="mt-1 text-[11px] leading-4 text-emerald-100/65">
                            This queue row has the information required by its current activation method.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {activeRowBlockers.map((blocker) => (
                          <div key={blocker} className="flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-500/[0.07] px-3 py-3">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-300" aria-hidden />
                            <p className="text-xs leading-5 text-rose-100">{blocker}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 space-y-2 border-t border-[var(--border)] bg-[var(--surface-elevated)]/90 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Actions
                  </p>
                  <Button
                    type="button"
                    onClick={() => runResidentPin(activeRow.id)}
                    disabled={!communityId || phase !== "idle"}
                    className="w-full justify-center gap-2"
                  >
                    <KeyRound className="size-3.5" aria-hidden />
                    Generate PIN
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => runResidentEmail(activeRow.id)}
                      disabled={!communityId || phase !== "idle"}
                      className="gap-2"
                    >
                      <Mail className="size-3.5" aria-hidden />
                      {selectedCount > 1
                        ? `${allSelectedAreInvited ? "Resend" : "Send"} ${selectedCount} selected`
                        : "Send invite"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => runResidentCreateUser(activeRow.id)}
                      disabled={!communityId || phase !== "idle"}
                      className="gap-2"
                    >
                      <UserPlus className="size-3.5" aria-hidden />
                      Create user
                    </Button>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
