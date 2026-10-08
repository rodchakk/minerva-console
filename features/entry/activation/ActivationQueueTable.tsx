"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  KeyRound,
  Mail,
  Pencil,
  Search,
  Send,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type {
  ActivationFollowUpStatus,
  ActivationQueueRow,
} from "@/features/entry/activation/actions";
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
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[10px] border border-emerald-400/20 bg-[#292431] p-6 shadow-xl">
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
          <p className="text-sm leading-6 text-[#A9A3B2]">
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
        className="flex w-full max-w-md flex-col gap-4 rounded-[10px] border border-[#141119] bg-[#292431] p-6 shadow-xl"
      >
        <div>
          <h3 className="text-lg font-semibold text-white">Change activation email</h3>
          <p className="mt-1 text-sm leading-6 text-[#A9A3B2]">
            Correct the email used for this resident&apos;s pre-activation flow.
          </p>
        </div>

        <div className="rounded-xl border border-[#141119] bg-[#2E2936] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#A9A3B2]">
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
            className="w-full rounded-lg border border-[#141119] bg-[#2E2936] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-[#A9A3B2] focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/15 disabled:opacity-60"
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
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[10px] border border-emerald-400/20 bg-[#292431] p-6 shadow-xl">
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
          <p className="text-sm leading-6 text-[#A9A3B2]">
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
        className="flex w-full max-w-md flex-col gap-4 rounded-[10px] border border-[#141119] bg-[#292431] p-6 shadow-xl"
      >
        <div>
          <h3 className="text-lg font-semibold text-white">Change activation phone</h3>
          <p className="mt-1 text-sm leading-6 text-[#A9A3B2]">
            Correct the phone number that will be stored for this resident.
          </p>
        </div>

        <div className="rounded-xl border border-[#141119] bg-[#2E2936] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#A9A3B2]">
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
            className="w-full rounded-lg border border-[#141119] bg-[#2E2936] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-[#A9A3B2] focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/15 disabled:opacity-60"
            placeholder="+504 9999-9999"
          />
        </label>

        <div
          className={
            row.method === "phone_pin"
              ? "flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-3 py-3"
              : "flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3"
          }
        >
          {row.method === "phone_pin" ? (
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
          ) : null}
          <p
            className={
              row.method === "phone_pin"
                ? "text-xs leading-5 text-amber-100/80"
                : "text-xs leading-5 text-[#A9A3B2]"
            }
          >
            {row.method === "phone_pin"
              ? "This resident uses Phone PIN activation. Changing the number will invalidate the current PIN and return the resident to Pending."
              : "Changing the phone preserves the current email or username activation. If this row is later configured for Phone PIN, the corrected number will be used."}
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
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[10px] border border-rose-400/20 bg-[#292431] p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white">PIN generation failed</h3>
          <p className="text-sm text-[#A9A3B2]">{result.error}</p>
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
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[10px] border border-[#141119] bg-[#292431] shadow-xl">
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
            <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-rose-200">
                All selected rows failed. Check that the residents are in a valid
                state and try again.
              </p>
            </div>
          ) : null}

          {isPartialFailure && !isAllFailed ? (
            <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-amber-100">
                {data.failed_count} row{data.failed_count !== 1 ? "s" : ""} failed.
                PINs were generated for the rest.
              </p>
            </div>
          ) : null}

          {generatedItems.length > 0 ? (
            <div className="mt-3 rounded-lg border border-violet-400/20 bg-violet-500/10 px-4 py-3">
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
                  className="rounded-lg border border-white/10 bg-[#2E2936] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-white">
                        {item.resident_name ?? "Unnamed resident"}
                      </p>
                      <p className="text-xs text-[#A9A3B2]">
                        {item.unit_label ?? "-"}
                        {item.email ? ` · ${item.email}` : ""}
                        {item.phone ? ` · ${item.phone}` : ""}
                      </p>
                      {item.suggested_username ? (
                        <p className="text-xs text-[#A9A3B2]">
                          Username:{" "}
                          <span className="font-medium text-slate-200">
                            {item.suggested_username}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      <div className="rounded-xl border border-violet-400/20 bg-[rgba(9,12,24,0.72)] px-4 py-2 text-center">
                        <p className="text-xs font-medium text-[#A9A3B2]">
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
              <p className="text-xs font-semibold uppercase tracking-wide text-[#A9A3B2]">
                Skipped / failed
              </p>
              {otherItems.map((item) => (
                <div
                  key={item.queue_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[rgba(9,12,24,0.56)] px-4 py-3 text-sm"
                >
                  <span className="text-slate-200">
                    {item.resident_name ?? item.queue_id}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge tone={item.status === "failed" ? "danger" : "default"}>
                      {item.status}
                    </Badge>
                    {item.message ? (
                      <span className="text-xs text-[#A9A3B2]">
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
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[10px] border border-rose-400/20 bg-[#292431] p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white">Email sending failed</h3>
          <p className="text-sm text-[#A9A3B2]">{result.error}</p>
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
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[10px] border border-[#141119] bg-[#292431] shadow-xl">
        <div className="flex-shrink-0 border-b border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white">Email invitation results</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            <Badge tone="success">{data.sent_count} sent</Badge>
            {data.skipped_count > 0 ? <Badge tone="default">{data.skipped_count} skipped</Badge> : null}
            {data.failed_count > 0 ? <Badge tone="danger">{data.failed_count} failed</Badge> : null}
            {!data.metadata_persisted ? <Badge tone="warning">metadata warning</Badge> : null}
          </div>
          {data.warning ? (
            <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {data.warning}
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {sentItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">Successfully Sent</p>
              {sentItems.map((item) => (
                <div key={item.queue_id} className="rounded-lg border border-white/10 bg-[#2E2936] px-4 py-3">
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
              <p className="text-xs font-semibold uppercase tracking-wide text-[#A9A3B2]">Failed / Skipped</p>
              {[...failedItems, ...skippedItems].map((item) => (
                <div key={item.queue_id} className="flex flex-col gap-1 rounded-lg border border-white/10 bg-[rgba(9,12,24,0.56)] px-4 py-3 text-sm">
                  <span className="text-slate-200 font-medium">{item.email}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={item.status === "failed" ? "danger" : "default"}>{item.status}</Badge>
                    <span className="text-xs text-[#A9A3B2]">{item.message}</span>
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
        <div className="flex w-full max-w-md flex-col gap-4 rounded-[10px] border border-rose-400/20 bg-[#292431] p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white">User creation failed</h3>
          <p className="text-sm text-[#A9A3B2]">{result.error}</p>
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
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[10px] border border-[#141119] bg-[#292431] shadow-xl">
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
            <div className="mt-3 rounded-lg border border-violet-400/20 bg-violet-500/10 px-4 py-3">
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
                  className="rounded-lg border border-white/10 bg-[#2E2936] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-white">
                        {item.resident_name ?? "Unnamed resident"}
                      </p>
                      <p className="text-xs text-[#A9A3B2]">
                        {item.unit_label ?? "-"}
                        {item.auth_type ? ` · ${item.auth_type}` : ""}
                      </p>
                      <p className="text-xs text-[#A9A3B2]">
                        Login:{" "}
                        <span className="font-medium text-slate-200">
                          {item.login_identity ?? "Not available"}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      <div className="rounded-xl border border-violet-400/20 bg-[rgba(9,12,24,0.72)] px-4 py-2 text-center">
                        <p className="text-xs font-medium text-[#A9A3B2]">
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
              <p className="text-xs font-semibold uppercase tracking-wide text-[#A9A3B2]">
                Skipped / failed
              </p>
              {otherItems.map((item) => (
                <div
                  key={item.queue_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[rgba(9,12,24,0.56)] px-4 py-3 text-sm"
                >
                  <span className="text-slate-200">
                    {item.resident_name ?? item.queue_id}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge tone={item.status === "failed" ? "danger" : "default"}>
                      {item.status}
                    </Badge>
                    {item.message ? (
                      <span className="text-xs text-[#A9A3B2]">
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

type FollowUpView =
  | "all"
  | "needs_follow_up"
  | "not_invited"
  | "recent"
  | "waiting";

function matchesFollowUpView(row: ActivationQueueRow, view: FollowUpView) {
  if (view === "all") return true;
  return row.followUpStatus === view;
}

function getFollowUpLabel(status: ActivationFollowUpStatus) {
  switch (status) {
    case "needs_follow_up":
      return "Needs follow-up";
    case "not_invited":
      return "Not invited";
    case "recent":
      return "Recent";
    case "waiting":
      return "Waiting";
    default:
      return "Completed";
  }
}

function getFollowUpTone(
  status: ActivationFollowUpStatus,
): "danger" | "default" | "info" | "success" | "warning" {
  switch (status) {
    case "needs_follow_up":
      return "danger";
    case "waiting":
      return "warning";
    case "recent":
      return "info";
    case "completed":
      return "success";
    default:
      return "default";
  }
}

function getFollowUpFilterLabel(view: FollowUpView) {
  if (view === "all") return "All";
  return getFollowUpLabel(view);
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

const ACTIVATION_QUEUE_PAGE_SIZE = 50;

type ResidentRecommendation = {
  action: "create" | "email" | "none" | "pin";
  description: string;
  label: string;
};

function getResidentRecommendation(row: ActivationQueueRow): ResidentRecommendation {
  if (row.status === "activated") {
    return {
      action: "none",
      label: "No activation action required",
      description: "This resident has already completed account activation.",
    };
  }

  if (row.status === "skipped") {
    return {
      action: "none",
      label: "Review skipped resident",
      description: "This resident is outside the normal activation flow.",
    };
  }

  if (row.status === "failed") {
    return {
      action: "none",
      label: "Review queue blockers",
      description: hasValue(row.lastError)
        ? row.lastError
        : "Resolve the queue error before attempting another activation action.",
    };
  }

  if (row.status === "invited") {
    return {
      action: "none",
      label: "Wait for resident activation",
      description:
        "An invitation has already been sent. Resend only after confirming non-delivery with the resident.",
    };
  }

  if (row.status === "pin_generated") {
    if (row.method === "email" && hasValue(row.email)) {
      return {
        action: "email",
        label: "Send activation invite",
        description:
          "The PIN is ready. Send the activation email so the resident can complete the flow.",
      };
    }

    return {
      action: "pin",
      label: "Generate / refresh PIN",
      description:
        "A PIN exists for this resident. Refresh it only when a new credential is required.",
    };
  }

  if (row.method === "email" && hasValue(row.email)) {
    return {
      action: "email",
      label: "Send activation invite",
      description:
        "Generate the activation credential and send the resident invitation by email.",
    };
  }

  if (row.method === "not_configured") {
    return {
      action: "create",
      label: "Choose activation method",
      description:
        "This resident does not have an activation method configured yet.",
    };
  }

  return {
    action: "pin",
    label: "Generate activation PIN",
    description:
      "Prepare the resident credential so activation can continue.",
  };
}

function QueueTag({
  label,
  tone,
}: {
  label: string;
  tone: "danger" | "default" | "info" | "success" | "warning";
}) {
  return (
    <span
      className={`inline-flex min-h-6 items-center whitespace-nowrap rounded-[4px] border px-2 py-1 text-[10px] font-semibold ${
        tone === "success"
          ? "border-[rgba(103,215,165,0.20)] bg-[rgba(103,215,165,0.06)] text-[#8EE2B9]"
          : tone === "danger"
            ? "border-[rgba(255,102,126,0.22)] bg-[rgba(255,102,126,0.06)] text-[#FFC1CB]"
            : tone === "warning"
              ? "border-[rgba(243,202,87,0.22)] bg-[rgba(243,202,87,0.06)] text-[#F2D77B]"
              : tone === "info"
                ? "border-[rgba(117,83,255,0.24)] bg-[rgba(117,83,255,0.08)] text-[#D8D1FF]"
                : "border-white/10 bg-white/[0.025] text-[#C8C1CD]"
      }`}
    >
      {label}
    </span>
  );
}

export function ActivationQueueTable({
  communityId,
  communityName,
  rows,
}: ActivationQueueTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [queueView, setQueueView] = useState<QueueView>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [followUpView, setFollowUpView] = useState<FollowUpView>(
    rows.some((row) => row.followUpStatus === "needs_follow_up")
      ? "needs_follow_up"
      : "all",
  );
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

  const followUpCounts = useMemo(
    () => ({
      all: rows.filter((row) =>
        ["pending", "pin_generated", "invited"].includes(row.status),
      ).length,
      needs_follow_up: rows.filter(
        (row) => row.followUpStatus === "needs_follow_up",
      ).length,
      not_invited: rows.filter((row) => row.followUpStatus === "not_invited").length,
      recent: rows.filter((row) => row.followUpStatus === "recent").length,
      waiting: rows.filter((row) => row.followUpStatus === "waiting").length,
      fourteen_plus: rows.filter(
        (row) =>
          row.followUpStatus === "needs_follow_up" &&
          (row.daysSinceLastInvitation ?? 0) >= 14,
      ).length,
      high_attempts: rows.filter(
        (row) =>
          !["activated", "skipped"].includes(row.status) &&
          row.invitationAttemptCount >= 5,
      ).length,
    }),
    [rows],
  );

  const followUpFilterOrder = useMemo<FollowUpView[]>(
    () =>
      followUpCounts.needs_follow_up > 0
        ? ["all", "needs_follow_up", "not_invited", "recent", "waiting"]
        : ["all", "not_invited", "recent", "waiting", "needs_follow_up"],
    [followUpCounts.needs_follow_up],
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const isPhoneLikeQuery = /^[+\d\s().-]+$/.test(searchQuery.trim());
    const normalizedDigits = isPhoneLikeQuery
      ? searchQuery.replace(/\D+/g, "")
      : "";

    return rows.filter((row) => {
      const matchesView = matchesQueueView(row, queueView);
      const followUpApplies = !["activated", "errors"].includes(queueView);
      const matchesFollowUp =
        !followUpApplies || matchesFollowUpView(row, followUpView);
      const matchesQuery =
        !normalizedQuery ||
        row.unit.toLowerCase().includes(normalizedQuery) ||
        row.resident.toLowerCase().includes(normalizedQuery) ||
        row.email.toLowerCase().includes(normalizedQuery) ||
        row.phone.toLowerCase().includes(normalizedQuery) ||
        (normalizedDigits.length > 0 && row.phone.replace(/\D+/g, "").includes(normalizedDigits)) ||
        row.suggestedUsername.toLowerCase().includes(normalizedQuery);

      // A search is a global lookup across the loaded activation queue. The status
      // and follow-up tabs are browsing filters and must not hide a matching person.
      if (normalizedQuery) {
        return matchesQuery;
      }

      return matchesView && matchesFollowUp;
    });
  }, [followUpView, queueView, rows, searchQuery]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredRows.length / ACTIVATION_QUEUE_PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount);
  const pageStartIndex = (currentPage - 1) * ACTIVATION_QUEUE_PAGE_SIZE;
  const pagedRows = filteredRows.slice(
    pageStartIndex,
    pageStartIndex + ACTIVATION_QUEUE_PAGE_SIZE,
  );
  const visibleRowIds = useMemo(
    () => pagedRows.map((row) => row.id),
    [pagedRows],
  );
  const visibleStart = filteredRows.length === 0 ? 0 : pageStartIndex + 1;
  const visibleEnd = Math.min(
    pageStartIndex + ACTIVATION_QUEUE_PAGE_SIZE,
    filteredRows.length,
  );
  const activeFilterCount =
    (queueView === "all" ? 0 : 1) + (followUpView === "all" ? 0 : 1);
  const allVisibleSelected =
    visibleRowIds.length > 0 &&
    visibleRowIds.every((rowId) => selectedIds.includes(rowId));
  const selectedCount = selectedIds.length;
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  const createUserTargetIds = selectedIds;
  const createUserTargetCount = selectedCount;
  const activeRow = activeRowId
    ? rows.find((row) => row.id === activeRowId) ?? null
    : null;
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

  const activeRecommendation = activeRow
    ? getResidentRecommendation(activeRow)
    : null;
  const activeRowActionable =
    !!activeRow && !["activated", "skipped"].includes(activeRow.status);

  function runRecommendedAction() {
    if (!activeRow || !activeRecommendation) return;

    if (activeRecommendation.action === "email") {
      runResidentEmail(activeRow.id);
      return;
    }

    if (activeRecommendation.action === "pin") {
      runResidentPin(activeRow.id);
      return;
    }

    if (activeRecommendation.action === "create") {
      runResidentCreateUser(activeRow.id);
    }
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
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[10px] border border-[#141119] bg-[#292431] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">
              Generate activation PINs?
            </h3>
            <p className="text-sm leading-6 text-[#A9A3B2]">
              This will generate activation PINs for{" "}
              <span className="font-semibold text-slate-100">{selectedCount}</span>{" "}
              selected prepared resident{selectedCount !== 1 ? "s" : ""}. It will{" "}
              <span className="font-semibold text-slate-100">not</span> create
              ENTRY users yet.
            </p>
            <p className="text-sm leading-6 text-[#A9A3B2]">
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
          <div className="rounded-[10px] border border-[#141119] bg-[#292431] px-8 py-6 shadow-xl">
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
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[10px] border border-[#141119] bg-[#292431] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">
              {someSelectedAreInvited
                ? "Resend activation email?"
                : "Send email invites?"}
            </h3>
            <p className="text-sm leading-6 text-[#A9A3B2]">
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
          <div className="rounded-[10px] border border-[#141119] bg-[#292431] px-8 py-6 shadow-xl">
            <p className="text-sm font-semibold text-white">Sending emails...</p>
          </div>
        </Overlay>
      ) : null}

      {phase === "emailResult" && emailResult !== null ? (
        <EmailResultModal result={emailResult} onClose={handleCloseEmailResult} />
      ) : null}

      {phase === "choosingAccess" ? (
        <Overlay>
          <div className="flex w-full max-w-2xl flex-col gap-4 rounded-[10px] border border-[#141119] bg-[#292431] p-6 shadow-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
                ENTRY user creation
              </p>
              <h3 className="mt-1 text-xl font-semibold text-white">
                Create ENTRY user{selectedCount !== 1 ? "s" : ""}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#A9A3B2]">
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
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[10px] border border-[#141119] bg-[#292431] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">
              Create active ENTRY users?
            </h3>
            <p className="text-sm leading-6 text-[#A9A3B2]">
              This will immediately create active ENTRY users for{" "}
              <span className="font-semibold text-slate-100">
                {createUserTargetCount}
              </span>{" "}
              resident{createUserTargetCount !== 1 ? "s" : ""} and generate a
              temporary password for each one.
            </p>
            <p className="text-sm leading-6 text-[#A9A3B2]">
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
          <div className="rounded-[10px] border border-[#141119] bg-[#292431] px-8 py-6 shadow-xl">
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
        <div className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF]">
          <div className="grid xl:grid-cols-[minmax(250px,1.2fr)_repeat(3,minmax(150px,.7fr))]">
            <button
              type="button"
              onClick={() => {
                setQueueView(queueCounts.errors > 0 ? "errors" : "ready");
                setFollowUpView("all");
                setPage(1);
              }}
              className="min-h-[86px] px-4 py-3.5 text-left transition hover:bg-white/[0.015]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8F879D]">
                Queue status
              </p>
              <div className="mt-2 flex items-center gap-2.5">
                <span
                  className={`size-2 rounded-full ${
                    queueCounts.errors > 0
                      ? "bg-[#FF667E] shadow-[0_0_0_4px_rgba(255,102,126,0.08)]"
                      : "bg-[#67D7A5] shadow-[0_0_0_4px_rgba(103,215,165,0.08)]"
                  }`}
                />
                <p className="text-sm font-semibold text-white">
                  {queueCounts.errors > 0 ? "Needs attention" : "Queue checks clear"}
                </p>
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-[#A9A3B2]">
                {queueCounts.errors > 0
                  ? `${queueCounts.errors} resident${queueCounts.errors === 1 ? "" : "s"} currently have queue errors.`
                  : "No activation errors are currently blocking resident activation."}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setQueueView("ready");
                setFollowUpView("all");
                setPage(1);
              }}
              className="min-h-[86px] border-t border-white/[0.07] px-4 py-3.5 text-left transition hover:bg-white/[0.015] xl:border-l xl:border-t-0"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8F879D]">
                Ready now
              </p>
              <p className="mt-1.5 text-xl font-semibold text-white">{queueCounts.ready}</p>
              <p className="mt-1 text-[10px] text-[#A9A3B2]">Prepared residents</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setQueueView("awaiting_activation");
                setFollowUpView("all");
                setPage(1);
              }}
              className="min-h-[86px] border-t border-white/[0.07] px-4 py-3.5 text-left transition hover:bg-white/[0.015] xl:border-l xl:border-t-0"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8F879D]">
                Awaiting activation
              </p>
              <p className="mt-1.5 text-xl font-semibold text-white">
                {queueCounts.awaiting_activation}
              </p>
              <p className="mt-1 text-[10px] text-[#A9A3B2]">Invitation already sent</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setQueueView("ready");
                setFollowUpView("needs_follow_up");
                setPage(1);
              }}
              className="min-h-[86px] border-t border-white/[0.07] px-4 py-3.5 text-left transition hover:bg-white/[0.015] xl:border-l xl:border-t-0"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8F879D]">
                Needs follow-up
              </p>
              <p className="mt-1.5 text-xl font-semibold text-white">
                {followUpCounts.needs_follow_up}
              </p>
              <p className="mt-1 text-[10px] text-[#A9A3B2]">Operator attention</p>
            </button>
          </div>
        </div>

        <section className="relative flex min-h-[560px] flex-col overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF] xl:h-[calc(100dvh-17rem)]">
          <div className="grid gap-3 border-b border-[#141119] px-4 py-3 lg:grid-cols-[auto_minmax(280px,1fr)_auto_auto] lg:items-center">
            <div className="min-w-[180px]">
              <h2 className="text-base font-semibold text-white">Residents</h2>
              <p className="mt-1 text-[10px] text-[#A9A3B2]">
                {rows.length} total · select a row for details
              </p>
            </div>

            <label className="relative block w-full max-w-[520px]">
              <span className="sr-only">Search activation queue</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8F879D]"
                aria-hidden
              />
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search name, unit, email, phone or username..."
                className="h-9 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] pl-9 pr-3 text-sm text-[#E7E5EA] shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
              />
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((value) => !value)}
                className="inline-flex h-9 min-w-[104px] items-center justify-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#141119]"
                aria-expanded={filterOpen}
              >
                <Filter className="size-3.5" aria-hidden />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="grid size-4 place-items-center rounded-[4px] bg-[#7553FF] text-[9px] text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>

              {filterOpen ? (
                <div className="absolute right-0 top-11 z-30 w-72 overflow-hidden rounded-lg border border-[#141119] bg-[#24202B] shadow-[0_18px_45px_rgba(0,0,0,0.42)]">
                  <div className="flex items-center justify-between border-b border-[#141119] px-3.5 py-3">
                    <p className="text-xs font-semibold text-white">Filter residents</p>
                    <button
                      type="button"
                      onClick={() => {
                        setQueueView("all");
                        setFollowUpView("all");
                        setPage(1);
                      }}
                      className="text-[10px] font-semibold text-[#BEB4FF] hover:text-white"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="p-2.5" aria-label="Activation queue filters">
                    <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                      Activation state
                    </p>
                    {(
                      [
                        "all",
                        "ready",
                        "pending_pin",
                        "pending_invite",
                        "awaiting_activation",
                        "activated",
                        "errors",
                      ] as QueueView[]
                    ).map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => {
                          setQueueView(view);
                          setPage(1);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs ${
                          queueView === view
                            ? "bg-[rgba(117,83,255,0.08)] text-white"
                            : "text-[#D3CEDA] hover:bg-white/[0.03] hover:text-white"
                        }`}
                      >
                        <span>{getQueueViewLabel(view)}</span>
                        <span className="text-[10px] text-[#8F879D]">{queueCounts[view]}</span>
                      </button>
                    ))}

                    <div className="my-2 border-t border-white/[0.06]" />

                    <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                      Follow-up
                    </p>
                    {followUpFilterOrder.map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => {
                          setFollowUpView(view);
                          setPage(1);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs ${
                          followUpView === view
                            ? "bg-[rgba(117,83,255,0.08)] text-white"
                            : "text-[#D3CEDA] hover:bg-white/[0.03] hover:text-white"
                        }`}
                      >
                        <span>{getFollowUpFilterLabel(view)}</span>
                        <span className="text-[10px] text-[#8F879D]">{followUpCounts[view]}</span>
                      </button>
                    ))}

                    <div className="mt-2 border-t border-[#141119] pt-2">
                      <button
                        type="button"
                        onClick={() => setFilterOpen(false)}
                        className="inline-flex h-8 w-full items-center justify-center rounded-[6px] border border-[#141119] bg-[#2E2936] text-xs font-semibold text-white"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={toggleAllVisibleRows}
              disabled={visibleRowIds.length === 0}
              className="inline-flex h-9 min-w-[112px] items-center justify-center whitespace-nowrap rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#141119] disabled:opacity-45"
            >
              {allVisibleSelected ? "Clear visible" : "Select visible"}
            </button>
          </div>

          {selectedCount > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#141119] bg-[rgba(117,83,255,0.055)] px-4 py-2.5">
              <p className="text-xs font-semibold text-[#D8D1FF]">
                {selectedCount} resident{selectedCount === 1 ? "" : "s"} selected
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccessMode("email");
                    setPhase("choosingAccess");
                  }}
                  disabled={!canCreateUsers || phase !== "idle"}
                  className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-[#141119] bg-[#2E2936] px-3 text-[11px] font-semibold text-white disabled:opacity-45"
                >
                  <UserPlus className="size-3.5" aria-hidden />
                  Create user
                </button>
                <button
                  type="button"
                  onClick={() => setPhase("confirmingEmail")}
                  disabled={!canGenerate || phase !== "idle"}
                  className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-[#141119] bg-[#2E2936] px-3 text-[11px] font-semibold text-white disabled:opacity-45"
                >
                  <Send className="size-3.5" aria-hidden />
                  {allSelectedAreInvited ? "Resend invite" : "Send invite"}
                </button>
                <button
                  type="button"
                  onClick={() => setPhase("confirming")}
                  disabled={!canGenerate || phase !== "idle"}
                  className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-[#120539] bg-[#7553FF] px-3 text-[11px] font-semibold text-white shadow-[0_2px_0_#120539] disabled:opacity-45"
                >
                  <KeyRound className="size-3.5" aria-hidden />
                  Generate PIN
                </button>
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable]">
            <table className="w-full min-w-[1160px] table-fixed border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-[#141119] bg-[#1F1B26] text-[#8F879D]">
                <tr className="text-[10px] uppercase tracking-[0.13em]">
                  <th className="w-11 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisibleRows}
                      className="size-4 accent-[#7553FF]"
                      aria-label="Select all visible residents"
                    />
                  </th>
                  <th className="w-[9%] px-3 py-2.5 font-semibold">Unit</th>
                  <th className="w-[18%] px-3 py-2.5 font-semibold">Resident</th>
                  <th className="w-[21%] px-3 py-2.5 font-semibold">Contact</th>
                  <th className="w-[15%] px-3 py-2.5 font-semibold">Username</th>
                  <th className="w-[11%] px-3 py-2.5 font-semibold">Method</th>
                  <th className="w-[13%] px-3 py-2.5 font-semibold">Status</th>
                  <th className="w-[14%] px-3 py-2.5 font-semibold">Follow-up</th>
                  <th className="w-[15%] px-3 py-2.5 font-semibold">Last action</th>
                  <th className="w-9 px-2 py-2.5"><span className="sr-only">Open details</span></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#141119] text-[#D6D0DC]">
                {pagedRows.map((row) => {
                  const isSelected = selectedIds.includes(row.id);
                  const isActive = activeRow?.id === row.id;

                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => focusRow(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          focusRow(row.id);
                        }
                      }}
                      className={`cursor-pointer outline-none transition ${
                        isActive
                          ? "bg-[rgba(117,83,255,0.075)] shadow-[inset_2px_0_0_#7553FF]"
                          : isSelected
                            ? "bg-[rgba(117,83,255,0.035)]"
                            : "hover:bg-white/[0.018]"
                      }`}
                    >
                      <td className="px-3 py-2.5 align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(row.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="size-4 accent-[#7553FF]"
                          aria-label={`Select ${row.resident}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top font-medium text-white">
                        <span className="block truncate" title={row.unit}>{row.unit}</span>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <span className="block truncate font-semibold text-white" title={row.resident}>
                          {row.resident}
                        </span>
                        {hasValue(row.lastError) ? (
                          <span className="mt-1 block truncate text-[10px] text-[#FFC1CB]" title={row.lastError}>
                            {row.lastError}
                          </span>
                        ) : (
                          <span className="mt-1 block text-[10px] text-[#8F879D]">Resident</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <span className="block truncate" title={row.phone}>{row.phone}</span>
                        <span className="mt-1 block truncate text-[10px] text-[#8F879D]" title={row.email}>
                          {row.email}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <span className="block truncate" title={row.suggestedUsername}>
                          {row.suggestedUsername}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <QueueTag
                          tone={getMethodTone(row.method)}
                          label={getMethodLabel(row.method)}
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <QueueTag
                          tone={getStatusTone(row.status)}
                          label={getStatusLabel(row.status)}
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <QueueTag
                          tone={getFollowUpTone(row.followUpStatus)}
                          label={getFollowUpLabel(row.followUpStatus)}
                        />
                        {row.followUpStatus !== "completed" ? (
                          <span className="mt-1 block text-[10px] text-[#8F879D]">
                            {row.invitationAttemptCount} invitation{row.invitationAttemptCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-top">
                        <span className="block text-[#D6D0DC]">{row.lastActivationAt}</span>
                        {row.lastActivationChannel !== "—" ? (
                          <span className="mt-1 block text-[10px] text-[#8F879D]">
                            {row.lastActivationChannel}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2.5 align-middle text-right">
                        <ChevronRight
                          className={`ml-auto size-4 ${
                            isActive ? "text-[#D8D1FF]" : "text-[#8F879D]"
                          }`}
                          aria-hidden
                        />
                      </td>
                    </tr>
                  );
                })}

                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center">
                      <p className="text-sm font-semibold text-white">No residents match this view</p>
                      <p className="mt-1 text-xs text-[#A9A3B2]">
                        Clear the search or filters to show residents again.
                      </p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#141119] bg-[#1F1B26] px-4 py-2 text-[10px] text-[#8F879D]">
            <span>
              Showing {visibleStart}-{visibleEnd} of {filteredRows.length} matching residents
              {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage <= 1}
                className="grid size-7 place-items-center rounded-[6px] border border-[#141119] bg-[#2E2936] text-white disabled:opacity-35"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" aria-hidden />
              </button>
              <span>{currentPage} / {pageCount}</span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                disabled={currentPage >= pageCount}
                className="grid size-7 place-items-center rounded-[6px] border border-[#141119] bg-[#2E2936] text-white disabled:opacity-35"
                aria-label="Next page"
              >
                <ChevronRight className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </section>

        {activeRow ? (
          <aside className="fixed bottom-5 right-5 top-[76px] z-40 grid w-[440px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border border-[#141119] bg-[#292431] shadow-[0_24px_70px_rgba(0,0,0,0.45)] max-xl:inset-x-0 max-xl:bottom-0 max-xl:top-[54px] max-xl:w-auto max-xl:rounded-none">
            <div className="border-b border-[#141119] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[rgba(117,83,255,0.28)] bg-[rgba(117,83,255,0.08)] text-sm font-semibold text-[#E3DEFF]">
                    {getInitials(activeRow.resident)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">
                      {activeRow.resident}
                    </p>
                    <p className="mt-1 text-xs text-[#A9A3B2]">
                      {activeRow.unit}{communityName ? ` · ${communityName}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRowId(null)}
                  className="grid size-8 shrink-0 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#8F879D] transition hover:text-white"
                  aria-label="Close resident details"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <QueueTag
                  tone={getStatusTone(activeRow.status)}
                  label={getStatusLabel(activeRow.status)}
                />
                <QueueTag
                  tone={getFollowUpTone(activeRow.followUpStatus)}
                  label={getFollowUpLabel(activeRow.followUpStatus)}
                />
              </div>

              <div className="relative mt-4 grid grid-cols-4">
                <span className="absolute left-[12%] right-[12%] top-[10px] h-px bg-white/10" />
                {getActivationStage(activeRow).map((stage, index) => (
                  <div key={stage.label} className="relative z-10 text-center">
                    <span
                      className={`mx-auto grid size-5 place-items-center rounded-full border text-[9px] font-semibold ${
                        stage.done
                          ? "border-[#7553FF] bg-[#7553FF] text-white"
                          : "border-white/15 bg-[#292431] text-[#8F879D]"
                      }`}
                    >
                      {stage.done ? "✓" : index + 1}
                    </span>
                    <p className={`mt-1.5 truncate text-[9px] ${
                      stage.done ? "text-white" : "text-[#8F879D]"
                    }`}>
                      {stage.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto overscroll-contain p-3.5 [scrollbar-gutter:stable]">
              <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
                <div className="border-b border-white/[0.07] px-3 py-2.5">
                  <p className="text-xs font-semibold text-white">Resident details</p>
                </div>
                {[
                  ["Unit", activeRow.unit],
                  ["Username", activeRow.suggestedUsername],
                  ["Method", getMethodLabel(activeRow.method)],
                  ["Last action", activeRow.lastActivationAt],
                  ["Created", activeRow.createdAt],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-b border-white/[0.06] px-3 py-2.5 text-[11px] last:border-b-0"
                  >
                    <span className="text-[#8F879D]">{label}</span>
                    <span className="break-words text-right text-white">{value}</span>
                  </div>
                ))}

                <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-t border-white/[0.06] px-3 py-2.5 text-[11px]">
                  <span className="text-[#8F879D]">Phone</span>
                  <span className="text-right text-white">
                    <span className="block break-all">{activeRow.phone}</span>
                    {!["activated", "skipped"].includes(activeRow.status) ? (
                      <button
                        type="button"
                        onClick={() => setPhoneEditorRowId(activeRow.id)}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#BEB4FF] hover:text-white"
                      >
                        <Pencil className="size-3" aria-hidden />
                        Edit phone
                      </button>
                    ) : null}
                  </span>
                </div>

                <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-t border-white/[0.06] px-3 py-2.5 text-[11px]">
                  <span className="text-[#8F879D]">Email</span>
                  <span className="text-right text-white">
                    <span className="block break-all">{activeRow.email}</span>
                    {!["activated", "skipped"].includes(activeRow.status) ? (
                      <button
                        type="button"
                        onClick={() => setEmailEditorRowId(activeRow.id)}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#BEB4FF] hover:text-white"
                      >
                        <Pencil className="size-3" aria-hidden />
                        Edit email
                      </button>
                    ) : null}
                  </span>
                </div>
              </section>

              <section className="mt-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
                <div className="border-b border-white/[0.07] px-3 py-2.5">
                  <p className="text-xs font-semibold text-white">Invitation history</p>
                </div>
                {[
                  ["First invitation", activeRow.firstInvitationSentAt],
                  ["Last invitation", activeRow.lastInvitationSentAt],
                  ["Attempts", String(activeRow.invitationAttemptCount)],
                  ["Last PIN generated", activeRow.lastPinGeneratedAt],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-b border-white/[0.06] px-3 py-2.5 text-[11px] last:border-b-0"
                  >
                    <span className="text-[#8F879D]">{label}</span>
                    <span className="break-words text-right text-white">{value}</span>
                  </div>
                ))}
              </section>

              {activeRow.followUpStatus === "needs_follow_up" ||
              activeRow.invitationAttemptCount >= 5 ? (
                <section className="mt-3 rounded-lg border border-[rgba(243,202,87,0.20)] bg-[rgba(243,202,87,0.055)] p-3">
                  <p className="text-xs font-semibold text-[#F2D77B]">Follow-up guidance</p>
                  <p className="mt-1.5 text-[11px] leading-5 text-[#D8CFAD]">
                    {activeRow.invitationAttemptCount >= 5
                      ? "Several invitations have already been sent. Confirm the resident contact information before sending another reminder."
                      : `The last invitation was sent ${activeRow.daysSinceLastInvitation ?? 8} days ago. This resident is ready for follow-up.`}
                  </p>
                </section>
              ) : null}

              <section className={`mt-3 rounded-lg border p-3 ${
                activeRowBlockers.length === 0
                  ? "border-[rgba(103,215,165,0.18)] bg-[rgba(103,215,165,0.045)]"
                  : "border-[rgba(255,102,126,0.20)] bg-[rgba(255,102,126,0.055)]"
              }`}>
                <p className={`text-xs font-semibold ${
                  activeRowBlockers.length === 0 ? "text-[#8EE2B9]" : "text-[#FFC1CB]"
                }`}>
                  {activeRowBlockers.length === 0 ? "Queue checks clear" : "Queue blockers"}
                </p>
                <p className="mt-1.5 text-[11px] leading-5 text-[#A9A3B2]">
                  {activeRowBlockers.length === 0
                    ? "This resident has the information required by the current activation method."
                    : activeRowBlockers.join(" · ")}
                </p>
              </section>
            </div>

            <div className="border-t border-[#141119] bg-[#292431] p-3">
              {activeRecommendation ? (
                <div className="mb-2.5 rounded-lg border border-[rgba(117,83,255,0.18)] bg-[rgba(117,83,255,0.055)] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#BEB4FF]">
                    Recommended next action
                  </p>
                  <p className="mt-1.5 text-xs font-semibold text-white">
                    {activeRecommendation.label}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-[#A9A3B2]">
                    {activeRecommendation.description}
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={runRecommendedAction}
                disabled={
                  !activeRecommendation ||
                  activeRecommendation.action === "none" ||
                  phase !== "idle"
                }
                className="inline-flex h-9 w-full items-center justify-center rounded-[7px] border border-[#120539] bg-[#7553FF] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#120539] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {activeRecommendation?.label ?? "No recommended action"}
              </button>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => runResidentPin(activeRow.id)}
                  disabled={!activeRowActionable || phase !== "idle"}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-[#141119] bg-[#2E2936] px-2 text-[10px] font-semibold text-white disabled:opacity-35"
                >
                  <KeyRound className="size-3" aria-hidden />
                  PIN
                </button>
                <button
                  type="button"
                  onClick={() => runResidentEmail(activeRow.id)}
                  disabled={!activeRowActionable || phase !== "idle"}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-[#141119] bg-[#2E2936] px-2 text-[10px] font-semibold text-white disabled:opacity-35"
                >
                  <Mail className="size-3" aria-hidden />
                  Invite
                </button>
                <button
                  type="button"
                  onClick={() => runResidentCreateUser(activeRow.id)}
                  disabled={!activeRowActionable || phase !== "idle"}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-[#141119] bg-[#2E2936] px-2 text-[10px] font-semibold text-white disabled:opacity-35"
                >
                  <UserPlus className="size-3" aria-hidden />
                  Create user
                </button>
              </div>
            </div>
          </aside>
        ) : null}
      </section>
    </>
  );
}
