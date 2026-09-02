"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";
import { updateFieldResidentProfile } from "@/features/entry/field/residentProfileActions";
import type { FieldResident } from "@/features/entry/field/peopleModel";

type FieldResidentProfileEditorProps = {
  communityId: string;
  isReadOnlyPreview: boolean;
  resident: FieldResident;
};

export function FieldResidentProfileEditor({
  communityId,
  isReadOnlyPreview,
  resident,
}: FieldResidentProfileEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(resident.fullName);
  const [phone, setPhone] = useState(resident.phone);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openEditor() {
    setFullName(resident.fullName);
    setPhone(resident.phone);
    setMessage(null);
    setEditing(true);
  }

  function cancelEditor() {
    setFullName(resident.fullName);
    setPhone(resident.phone);
    setMessage(null);
    setEditing(false);
  }

  function saveProfile() {
    setMessage(null);

    startTransition(async () => {
      const result = await updateFieldResidentProfile({
        communityId,
        fullName,
        phone,
        userId: resident.userId,
      });

      if (!result.success) {
        setMessage(result.error || "Could not update resident profile.");
        return;
      }

      setFullName(result.fullName ?? fullName.trim());
      setPhone(result.phone ?? phone.trim());
      setEditing(false);
      setMessage("Resident profile updated.");
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Pencil aria-hidden="true" className="h-4 w-4 text-[var(--console-accent)]" />
            <h2 className="text-lg font-semibold text-[var(--console-text)]">
              Resident profile
            </h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
            Edit contact details without changing login identity or account access.
          </p>
        </div>
      </div>

      {isReadOnlyPreview ? (
        <p className="text-xs leading-5 text-amber-200">
          Preview is read-only. Profile changes are disabled.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--console-text-muted)]">
          {message}
        </p>
      ) : null}

      {!editing ? (
        <button
          type="button"
          onClick={openEditor}
          disabled={isPending || isReadOnlyPreview}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
          Edit resident
        </button>
      ) : (
        <div className="space-y-4 rounded-lg border border-[var(--console-border)] bg-white/[0.025] p-3">
          <label className="grid gap-2 text-sm font-semibold text-[var(--console-text)]">
            Full name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={120}
              autoComplete="name"
              className="min-h-12 rounded-lg border border-[var(--console-border)] bg-[var(--console-bg)] px-3 text-base font-normal text-[var(--console-text)] outline-none transition focus:border-[var(--console-accent)]"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-[var(--console-text)]">
            Phone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={40}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Optional"
              className="min-h-12 rounded-lg border border-[var(--console-border)] bg-[var(--console-bg)] px-3 text-base font-normal text-[var(--console-text)] outline-none transition focus:border-[var(--console-accent)]"
            />
          </label>

          <p className="text-xs leading-5 text-[var(--console-text-soft)]">
            Username, email, password, unit and account status stay unchanged.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={cancelEditor}
              disabled={isPending}
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] px-3 text-sm font-semibold text-[var(--console-text)] disabled:opacity-50"
            >
              <X aria-hidden="true" className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="button"
              onClick={saveProfile}
              disabled={isPending || isReadOnlyPreview || !fullName.trim()}
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              {isPending ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
