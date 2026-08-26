"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Building2,
  Ellipsis,
  ExternalLink,
  Home,
  KeyRound,
  Mail,
  Search,
  Users,
} from "lucide-react";
import {
  generateTemporaryRecoveryCodeAction,
  searchUsersAction,
  sendPasswordResetEmailAction,
  type UserSearchItem,
} from "@/features/entry/users/actions";
import { cn } from "@/lib/supabase/utils";

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

function buttonClass(variant: "primary" | "secondary" | "ghost" | "danger") {
  return cn(
    "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50 disabled:cursor-not-allowed disabled:opacity-60",
    variant === "primary"
      ? "border border-transparent bg-[var(--console-accent-subtle)] text-violet-100 hover:bg-violet-500/20"
      : "",
    variant === "secondary"
      ? "border border-[var(--console-border)] bg-white/[0.025] text-slate-100 hover:bg-white/[0.05]"
      : "",
    variant === "ghost"
      ? "border border-transparent bg-transparent text-[var(--console-text-muted)] hover:bg-white/[0.04] hover:text-white"
      : "",
    variant === "danger"
      ? "border border-rose-400/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15"
      : "",
  );
}

function SearchButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={buttonClass("primary")} disabled={pending}>
      {pending ? "Searching..." : "Search users"}
    </button>
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
    <button type="button" className={buttonClass("ghost")} onClick={handleCopy}>
      {copied ? "Copied" : "Copy code"}
    </button>
  );
}

function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[11px] font-semibold leading-4",
        className,
      )}
    >
      {children}
    </span>
  );
}

function PasswordResetSubmitButton({
  idleLabel,
  pendingLabel,
  disabled = false,
}: {
  idleLabel: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      role="menuitem"
      disabled={disabled || pending}
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:text-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <KeyRound className="h-4 w-4 shrink-0 stroke-[1.75] text-[var(--console-text-muted)]" />
      <span>{pending ? pendingLabel : idleLabel}</span>
    </button>
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
      <div className="flex flex-col">
        {user.role === "RESIDENT" ? (
          <form action={codeAction}>
            <input type="hidden" name="communityId" value={user.communityId} />
            <input type="hidden" name="email" value={user.email} />
            <input type="hidden" name="fullName" value={user.fullName} />
            <input type="hidden" name="houseLabel" value={user.houseLabel} />
            <input type="hidden" name="role" value={user.role} />
            <input type="hidden" name="userId" value={user.id} />
            <PasswordResetSubmitButton
              idleLabel="Reset password"
              pendingLabel="Generating..."
            />
          </form>
        ) : (
          <button
            type="button"
            role="menuitem"
            disabled
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold text-slate-400 opacity-60 cursor-not-allowed"
            title="PIN reset required"
          >
            <KeyRound className="h-4 w-4 shrink-0 stroke-[1.75] text-[var(--console-text-muted)]" />
            <span>Reset password</span>
          </button>
        )}

        {codeState.success && codeState.code ? (
          <div className="mx-1 mt-1.5 rounded-md border border-emerald-400/20 bg-emerald-500/10 p-2.5 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300/80">
              Temporary code
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-emerald-100 select-all">
              {codeState.code}
            </p>
            {expirationLabel ? (
              <p className="mt-1 text-[11px] text-emerald-200/80">
                Expires: {expirationLabel}
              </p>
            ) : null}
            <div className="mt-2 flex items-center gap-2">
              <CopyCodeButton code={codeState.code} />
            </div>
          </div>
        ) : null}

        {codeState.error ? (
          <p className="mt-1.5 px-3 text-xs font-medium text-rose-300">
            {codeState.error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <form action={emailAction}>
        <input type="hidden" name="email" value={user.email} />
        <input type="hidden" name="fullName" value={user.fullName} />
        <PasswordResetSubmitButton
          idleLabel="Reset password"
          pendingLabel="Sending..."
        />
      </form>
      {emailState.success ? (
        <p className="mt-1.5 px-3 text-xs font-medium text-emerald-300">
          Password reset email sent.
        </p>
      ) : null}
      {emailState.error ? (
        <p className="mt-1.5 px-3 text-xs font-medium text-rose-300">
          {emailState.error}
        </p>
      ) : null}
    </div>
  );
}

function UserActionsMenu({ user }: { user: UserSearchItem }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative flex justify-end">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Actions for ${user.fullName}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] text-slate-300 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Ellipsis className="h-4 w-4 stroke-[1.75]" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
        >
          {user.communityId ? (
            <Link
              href={`/products/entry/communities/${user.communityId}`}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:text-white focus-visible:outline-none"
              onClick={() => setIsOpen(false)}
            >
              <ExternalLink className="h-4 w-4 shrink-0 stroke-[1.75] text-[var(--console-text-muted)]" />
              <span>Open community</span>
            </Link>
          ) : null}

          {user.communityId ? (
            <Link
              href={`/products/entry/communities/${user.communityId}/users`}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:text-white focus-visible:outline-none"
              onClick={() => setIsOpen(false)}
            >
              <Users className="h-4 w-4 shrink-0 stroke-[1.75] text-[var(--console-text-muted)]" />
              <span>Manage in community</span>
            </Link>
          ) : null}

          {user.communityId ? (
            <div className="my-1 border-t border-[var(--console-border)]" />
          ) : null}

          <PasswordResetControl user={user} />
        </div>
      ) : null}
    </div>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";

  return (
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--console-border-strong)] bg-[var(--console-accent-subtle)] text-xs font-semibold text-violet-100">
      {initials}
    </span>
  );
}

export function UserSearch() {
  const [state, formAction] = useActionState(searchUsersAction, { results: [] });
  const hasQuery = Boolean(state.query);
  const hasResults = Boolean(state.results && state.results.length > 0);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-5 py-4">
        <form action={formAction}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search by full name or email</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 stroke-[1.75] text-[var(--console-text-soft)]" />
              <input
                name="query"
                type="text"
                defaultValue={state.query}
                className="h-9 w-full rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
                placeholder="Search by full name or email"
              />
            </label>
            <SearchButton />
          </div>
          {state.message ? (
            <p className="mt-3 text-sm text-rose-300">{state.message}</p>
          ) : null}
        </form>
      </section>

      {hasResults ? (
        <section className="overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]">
          <div className="min-h-[220px] overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[minmax(340px,1.4fr)_minmax(260px,1fr)_100px] items-center gap-4 border-b border-[var(--console-border)] bg-white/[0.015] px-5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                  User
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                  Context
                </p>
                <p className="text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                  Actions
                </p>
              </div>

              <div className="divide-y divide-[var(--console-border)]">
                {state.results?.map((user) => {
                  const primaryIdentity = getPrimaryIdentity(
                    user.email,
                    user.username,
                  );
                  const secondaryIdentity = getSecondaryIdentity(
                    user.email,
                    user.username,
                  );

                  return (
                    <article
                      key={user.id}
                      className="grid grid-cols-[minmax(340px,1.4fr)_minmax(260px,1fr)_100px] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.025]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <UserAvatar name={user.fullName} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="truncate text-base font-semibold leading-5 text-white">
                                {user.fullName}
                              </h3>
                              <Chip className="border-violet-400/15 bg-violet-500/[0.08] text-violet-100">
                                {user.role}
                              </Chip>
                              <Chip
                                className={
                                  user.isActive
                                    ? "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200"
                                    : "border-amber-400/20 bg-amber-500/[0.08] text-amber-200"
                                }
                              >
                                {user.isActive ? "Active" : "Inactive"}
                              </Chip>
                            </div>
                            <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-violet-100">
                              <Mail className="h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
                              <span className="truncate">{primaryIdentity}</span>
                            </p>
                            {secondaryIdentity ? (
                              <p className="mt-0.5 truncate text-xs text-[var(--console-text-muted)]">
                                {secondaryIdentity}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-[var(--console-border)]">
                        <div className="min-w-0 pr-3">
                          <p className="flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                            <Building2 className="h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
                            Community
                          </p>
                          <p className="mt-2 truncate text-sm font-semibold leading-5 text-white">
                            {user.communityName}
                          </p>
                          {user.communityCity ? (
                            <p className="mt-0.5 truncate text-xs text-[var(--console-text-muted)]">
                              {user.communityCity}
                            </p>
                          ) : null}
                        </div>
                        <div className="min-w-0 pl-3">
                          <p className="flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                            <Home className="h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
                            Unit
                          </p>
                          <p className="mt-2 truncate text-sm font-semibold leading-5 text-white">
                            {user.houseLabel || "No unit linked"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <UserActionsMenu user={user} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {state.results && state.results.length === 0 && hasQuery ? (
        <section className="rounded-lg border border-dashed border-[var(--console-border-strong)] bg-[var(--console-surface)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--console-text-muted)]">
            No users matched <span className="font-semibold">{state.query}</span>.
          </p>
        </section>
      ) : null}
    </div>
  );
}
