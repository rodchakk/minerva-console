"use client";

import { useState } from "react";
import type * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ActivationQueueRow } from "@/features/entry/activation/actions";
import { updateActivationEmail, type UpdateActivationEmailResult } from "@/features/entry/activation/emailEditActions";
import { updateActivationPhone, type UpdateActivationPhoneResult } from "@/features/entry/activation/phoneEditActions";

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      {children}
    </div>
  );
}

export function EditActivationEmailModal({
  communityId,
  row,
  onClose,
  onChanged,
}: {
  communityId: string;
  row: ActivationQueueRow;
  onClose: () => void;
  onChanged?: () => void;
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
      onChanged?.();
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

export function EditActivationPhoneModal({
  communityId,
  row,
  onClose,
  onChanged,
}: {
  communityId: string;
  row: ActivationQueueRow;
  onClose: () => void;
  onChanged?: () => void;
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
      onChanged?.();
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

