"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  generateTemporaryRecoveryCodeAction,
  searchUsersAction,
  sendPasswordResetEmailAction,
  type UserSearchItem,
} from "@/features/entry/users/actions";

function isSyntheticEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  return (
    !normalized ||
    normalized.endsWith("@entry.local") ||
    normalized.endsWith("@entry.internal")
  );
}

function getPrimaryIdentity(email: string, username: string) {
  const trimmedUsername = username.trim();

  if (trimmedUsername) {
    return `@${trimmedUsername}`;
  }

  if (isSyntheticEmail(email)) {
    return "Sin correo";
  }

  return email;
}

function getSecondaryIdentity(email: string, username: string) {
  const trimmedUsername = username.trim();

  if (trimmedUsername && !isSyntheticEmail(email)) {
    return email;
  }

  return "";
}

function SearchButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Searching..." : "Search users"}
    </Button>
  );
}

function ActionButton({
  idleLabel,
  pendingLabel,
  variant = "secondary",
}: {
  idleLabel: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}

function formatExpiration(expiresAt?: string | null) {
  if (!expiresAt) return "";

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return expiresAt;
  }

  return date.toLocaleString("es-HN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button type="button" variant="ghost" onClick={handleCopy}>
      {copied ? "Copied" : "Copy code"}
    </Button>
  );
}

function PasswordResetControl({ user }: { user: UserSearchItem }) {
  const [emailState, emailAction] = useActionState(sendPasswordResetEmailAction, {});
  const [codeState, codeAction] = useActionState(generateTemporaryRecoveryCodeAction, {});
  const expirationLabel = useMemo(
    () => formatExpiration(codeState.expiresAt),
    [codeState.expiresAt],
  );

  if (isSyntheticEmail(user.email)) {
    return (
      <div className="flex flex-col items-start gap-2 xl:items-end">
        {user.role === "RESIDENT" ? (
          <form action={codeAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="communityId" value={user.communityId} />
            <input type="hidden" name="email" value={user.email} />
            <input type="hidden" name="fullName" value={user.fullName} />
            <input type="hidden" name="houseLabel" value={user.houseLabel} />
            <input type="hidden" name="role" value={user.role} />
            <input type="hidden" name="userId" value={user.id} />
            <ActionButton
              idleLabel="Generate code"
              pendingLabel="Generating..."
              variant="secondary"
            />
          </form>
        ) : (
          <Button variant="secondary" disabled>
            PIN reset required
          </Button>
        )}

        {codeState.success && codeState.code ? (
          <div className="w-full rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-left xl:max-w-xs">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
              Temporary code
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-emerald-100">
              {codeState.code}
            </p>
            {expirationLabel ? (
              <p className="mt-1 text-xs text-emerald-200/80">
                Expires: {expirationLabel}
              </p>
            ) : null}
            <div className="mt-2 flex items-center gap-2">
              <CopyCodeButton code={codeState.code} />
            </div>
          </div>
        ) : null}

        {codeState.error ? (
          <p className="text-xs font-medium text-rose-300">{codeState.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 xl:items-end">
      <form action={emailAction}>
        <input type="hidden" name="email" value={user.email} />
        <input type="hidden" name="fullName" value={user.fullName} />
        <ActionButton
          idleLabel="Reset Password"
          pendingLabel="Sending..."
          variant="secondary"
        />
      </form>
      {emailState.success ? (
        <p className="text-xs font-medium text-emerald-300">
          Password reset email sent.
        </p>
      ) : null}
      {emailState.error ? (
        <p className="text-xs font-medium text-rose-300">{emailState.error}</p>
      ) : null}
    </div>
  );
}

export function UserSearch() {
  const [state, formAction] = useActionState(searchUsersAction, { results: [] });

  return (
    <div className="space-y-6">
      <form
        action={formAction}
        className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur"
      >
        <div className="flex flex-col gap-4 lg:flex-row">
          <input
            name="query"
            type="text"
            defaultValue={state.query}
            className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
            placeholder="Search by full name or email"
          />
          <SearchButton />
        </div>
        {state.message ? (
          <p className="mt-4 text-sm text-rose-300">{state.message}</p>
        ) : null}
      </form>

      <div className="space-y-4">
        {state.results?.map((user) => (
          <article
            key={user.id}
            className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center xl:gap-x-5 xl:gap-y-2">
                  <h3 className="truncate text-base font-semibold text-white">
                    {user.fullName}
                  </h3>
                  <p className="truncate text-sm font-medium text-violet-100">
                    {getPrimaryIdentity(user.email, user.username)}
                  </p>
                  {getSecondaryIdentity(user.email, user.username) ? (
                    <p className="truncate text-sm text-[var(--text-muted)]">
                      {getSecondaryIdentity(user.email, user.username)}
                    </p>
                  ) : null}
                  <p className="truncate text-sm text-[var(--text-soft)]">
                    <span className="font-semibold text-white">Community:</span>{" "}
                    {user.communityName}
                    {user.communityCity ? ` · ${user.communityCity}` : ""}
                  </p>
                  {user.houseLabel ? (
                    <p className="truncate text-sm text-[var(--text-soft)]">
                      <span className="font-semibold text-white">Unit:</span>{" "}
                      {user.houseLabel}
                    </p>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Badge tone="info">{user.role}</Badge>
                  <Badge tone={user.isActive ? "success" : "warning"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                {user.communityId ? (
                  <Link href={`/products/entry/communities/${user.communityId}`}>
                    <Button variant="secondary">Open community</Button>
                  </Link>
                ) : null}
                {user.communityId ? (
                  <Link
                    href={`/products/entry/communities/${user.communityId}/users`}
                  >
                    <Button>Manage in community</Button>
                  </Link>
                ) : null}
                <PasswordResetControl user={user} />
              </div>
            </div>
          </article>
        ))}

        {state.results && state.results.length === 0 && state.query ? (
          <div className="rounded-[28px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-10 text-center text-sm text-[var(--text-muted)] shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
            No users matched <span className="font-semibold">{state.query}</span>.
          </div>
        ) : null}
      </div>
    </div>
  );
}
