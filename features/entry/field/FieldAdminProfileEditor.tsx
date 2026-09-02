"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";
import { updateFieldAdminProfile } from "@/features/entry/field/adminProfileActions";
import type { FieldResident } from "@/features/entry/field/peopleModel";

type Props = {
  communityId: string;
  isReadOnlyPreview: boolean;
  user: FieldResident;
};

export function FieldAdminProfileEditor({
  communityId,
  isReadOnlyPreview,
  user,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openEditor() {
    setFullName(user.fullName);
    setPhone(user.phone);
    setMessage(null);
    setEditing(true);
  }

  function cancelEditor() {
    setFullName(user.fullName);
    setPhone(user.phone);
    setMessage(null);
    setEditing(false);
  }

  function saveProfile() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateFieldAdminProfile({
        communityId,
        fullName,
        phone,
        userId: user.userId,
      });

      if (!result.success) {
        setMessage(result.error || "Could not update admin profile.");
        return;
      }

      setFullName(result.fullName ?? fullName.trim());
      setPhone(result.phone ?? phone.trim());
      setEditing(false);
      setMessage("Admin profile updated.");
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
      <div className="flex items-center gap-2">
        <Pencil aria-hidden="true" className="h-4 w-4 text-[var(--console-accent)]" />
        <h2 className="text-lg font-semibold text-[var(--console-text)]">
          Admin profile
        </h2>
      </div>
      <p className="text-sm leading-6 text-[var(--console-text-muted)]">
        Edit name and phone without changing login identity, role, or account status.
      </p>

      {isReadOnlyPreview ? (
        <p className="text-xs leading-5 text-amber-200">
          Preview is read-only. Save changes is disabled.
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
          disabled={isPending}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
          Edit admin
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
