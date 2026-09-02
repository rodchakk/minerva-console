"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createFieldGuardAction } from "@/features/entry/field/accessActions";
import type { StaffActionState } from "@/features/entry/staff/actions";

export type FieldGuardCommunityOption = {
  id: string;
  name: string;
};

function CreateGuardButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-lg bg-[var(--console-accent)] px-4 text-sm font-bold text-white transition-colors hover:brightness-110 active:brightness-95 disabled:opacity-50"
    >
      {pending ? "Creating..." : "Create guard"}
    </button>
  );
}

export function FieldCreateGuardForm({
  communities,
}: {
  communities: FieldGuardCommunityOption[];
}) {
  const [state, action] = useActionState<StaffActionState, FormData>(
    createFieldGuardAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="accountType" value="individual" />
      <input type="hidden" name="email" value="" />
      <input type="hidden" name="description" value="" />

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[var(--console-text)]">
          Community
        </span>
        <select
          name="communityId"
          defaultValue=""
          required
          className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent-border)]"
        >
          <option value="" disabled>
            Select community
          </option>
          {communities.map((community) => (
            <option key={community.id} value={community.id}>
              {community.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[var(--console-text)]">
          Full name
        </span>
        <input
          name="fullName"
          required
          autoComplete="off"
          className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-3 text-base text-[var(--console-text)] outline-none placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
          placeholder="Guard name"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[var(--console-text)]">
          Username
        </span>
        <input
          name="username"
          required
          autoCapitalize="none"
          autoComplete="off"
          className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-3 text-base text-[var(--console-text)] outline-none placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
          placeholder="guard_main"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[var(--console-text)]">
          Temporary password
        </span>
        <input
          name="password"
          type="text"
          required
          minLength={8}
          autoComplete="off"
          className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-3 text-base text-[var(--console-text)] outline-none placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
          placeholder="Minimum 8 characters"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[var(--console-text)]">
          Phone <span className="font-normal text-[var(--console-text-soft)]">optional</span>
        </span>
        <input
          name="phone"
          inputMode="tel"
          className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-3 text-base text-[var(--console-text)] outline-none placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
          placeholder="Optional"
        />
      </label>

      <p className="text-xs leading-5 text-[var(--console-text-soft)]">
        Guard accounts are created without a unit assignment.
      </p>

      {state.message ? (
        <p
          className={`rounded-lg border p-3 text-sm leading-6 ${
            state.ok
              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
              : "border-rose-300/25 bg-rose-300/10 text-rose-100"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <CreateGuardButton />
    </form>
  );
}
