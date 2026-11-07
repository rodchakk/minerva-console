"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildActivationWhatsAppMessage } from "@/features/entry/activation/activationWhatsAppMessage";
import { ResidentAccessModePicker, type ResidentAccessMode } from "@/features/entry/activation/ResidentAccessModePicker";
import { sendActivationEmails } from "@/features/entry/activation/emailActions";
import { generateActivationPins } from "@/features/entry/activation/pinActions";

export type ExistingActivationTarget = {
  queueId: string;
  communityId: string;
  communityName: string;
  residentName: string;
  unitLabel: string;
  email: string;
  method: string;
  status: string;
};

// Shared by the activation queue and the global Users seeker. This deliberately
// uses the same PIN/email server actions and WhatsApp template as resident creation;
// it never inserts another queue record or creates another user.
export function ManageResidentActivationDialog({
  target,
  onClose,
}: {
  target: ExistingActivationTarget;
  onClose: () => void;
}) {
  const router = useRouter();
  const canEmail = target.method === "email" && Boolean(
    target.email && target.email !== "—" && target.email.includes("@"),
  );
  const [mode, setMode] = useState<ResidentAccessMode>(canEmail ? "email" : "pin");
  const [isPending, startTransition] = useTransition();
  const [pin, setPin] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const message = pin
    ? buildActivationWhatsAppMessage({
        communityName: target.communityName,
        residentName: target.residentName,
        unitLabel: target.unitLabel,
        pin,
      })
    : "";

  function close() {
    if (isPending) return;
    setPin(null);
    onClose();
  }

  function submit() {
    if (isPending || pin) return;
    setError(null);
    setWarning(null);
    setCopied(false);

    startTransition(async () => {
      if (mode === "email") {
        // The PIN returned is the exact one generated for this email.
        // Never generate a second PIN after sending: it would invalidate the first.
        const delivery = await sendActivationEmails({
          communityId: target.communityId,
          communityName: target.communityName,
          queueIds: [target.queueId],
          includePinForSharing: true,
        });
        if (!delivery.success) {
          setError(delivery.error ?? "Could not send the activation invitation.");
          return;
        }
        const item = delivery.data?.items.find((value) => value.queue_id === target.queueId);
        if (!item?.pinForSharing) {
          setError(item?.message ?? "No activation PIN was returned. Check the queue before retrying.");
          return;
        }
        setPin(item.pinForSharing);
        setEmailSent(item.status === "sent");
        setWarning(item.message ?? delivery.data?.warning ?? (
          item.status === "sent" ? null : "The email was not sent. You can still share the generated PIN securely."
        ));
      } else {
        const generation = await generateActivationPins({
          communityId: target.communityId,
          queueIds: [target.queueId],
        });
        if (!generation.success) {
          setError(generation.error);
          return;
        }
        const item = generation.data.items.find((value) => value.queue_id === target.queueId);
        if (!item?.pin || item.status !== "pin_generated") {
          setError(item?.message ?? "No activation PIN was generated. Check the queue before retrying.");
          return;
        }
        setPin(item.pin);
        setEmailSent(false);
      }
      router.refresh();
    });
  }

  async function copyForWhatsApp() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setError(null);
    } catch {
      setError("Could not copy the WhatsApp message. Select and copy the text manually.");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Manage resident activation"
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-white/15 bg-[#211E26] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#BEB4FF]">
              ENTRY resident activation
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">Manage activation</h2>
            <p className="mt-2 text-xs text-[#A9A3B2]">
              {target.residentName} · {target.unitLabel} · {target.communityName}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isPending}
            className="rounded-md border border-white/10 p-2 text-[#A9A3B2] hover:text-white disabled:opacity-40"
            aria-label="Close activation dialog"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 space-y-4 overflow-y-auto p-5">
          {pin ? (
            <>
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {emailSent
                  ? "Invitation sent. This is the same PIN included in the email."
                  : "PIN generated. No invitation email was sent."}
              </div>
              {warning ? (
                <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                  {warning}
                </p>
              ) : null}
              <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#BEB4FF]">
                  Activation PIN · expires in 7 days
                </p>
                <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.2em] text-white">
                  {pin}
                </p>
                <p className="mt-3 text-xs leading-5 text-[#A9A3B2]">
                  Copy the message now. This code is shown only for this operation.
                  Only share it with the intended resident or an authorized contact.
                </p>
              </div>
              <label className="block text-xs font-semibold text-white" htmlFor="entry-whatsapp-activation-message">
                WhatsApp message
              </label>
              <textarea
                id="entry-whatsapp-activation-message"
                readOnly
                value={message}
                rows={10}
                className="w-full resize-none rounded-lg border border-white/10 bg-[#292431] p-3 text-xs leading-5 text-white"
              />
            </>
          ) : (
            <>
              <p className="text-xs leading-5 text-[#A9A3B2]">
                Use the existing ENTRY activation flow for this resident.
                Sending an email or regenerating a PIN replaces any previous activation PIN.
              </p>
              <ResidentAccessModePicker
                value={mode}
                onChange={setMode}
                hideQuick
                existingResident
                disabled={{
                  email: canEmail
                    ? undefined
                    : "Email invitation is only available for an existing email-based queue record with an email address.",
                }}
              />
            </>
          )}
          {error ? (
            <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 p-4">
          {pin ? (
            <>
              <Button type="button" variant="secondary" onClick={copyForWhatsApp}>
                {copied ? <Check className="mr-2 size-4" aria-hidden /> : <Copy className="mr-2 size-4" aria-hidden />}
                {copied ? "Copied" : "Copy for WhatsApp"}
              </Button>
              <Button type="button" onClick={close}>Done</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={close} disabled={isPending}>
                Cancel
              </Button>
              <Button type="button" onClick={submit} disabled={isPending || (mode === "email" && !canEmail)}>
                {isPending ? "Working..." : mode === "email" ? "Send invitation + prepare WhatsApp" : "Generate PIN for WhatsApp"}
              </Button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
