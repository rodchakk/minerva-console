"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MapPin, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { setCommunityActiveStatusAction } from "@/features/entry/communities/statusActions";
import type { CommunityListItem } from "@/features/entry/communities/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";
import { cn } from "@/lib/supabase/utils";

type CommunityListProps = {
  communities: CommunityListItem[];
};

type PendingCommunityAction = {
  community: CommunityListItem;
  nextIsActive: boolean;
};

function getSetupState(community: CommunityListItem) {
  if (!community.isActive && community.onboardingStatus === "complete_active") {
    return {
      label: "Needs review",
      tone: "warning" as const,
      progressTone: "bg-amber-400",
    };
  }

  if (
    community.totalUnits <= 0 ||
    community.nextStepKey === "units" ||
    (community.onboardingStatus !== "complete_active" &&
      community.totalMembers <= 0 &&
      community.activationPendingCount <= 0)
  ) {
    return {
      label: "Needs attention",
      tone: "warning" as const,
      progressTone: "bg-amber-400",
    };
  }

  if (community.onboardingStatus === "complete_active") {
    return {
      label: "Complete",
      tone: "success" as const,
      progressTone: "bg-emerald-400",
    };
  }

  return {
    label: "Pending setup",
    tone: "warning" as const,
    progressTone: "bg-[var(--console-accent)]",
  };
}

function getProgressWidth(completed: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.round((completed / total) * 100))}%`;
}

function getProgressValue(completed: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((completed / total) * 100));
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "MC"
  );
}

function formatUnitLabel(label: string) {
  const normalized = label.trim().toLowerCase();

  if (normalized === "condominios") {
    return "Condos";
  }

  return label;
}

function getCta(community: CommunityListItem) {
  const setupState = getSetupState(community);

  if (community.onboardingStatus === "complete_active") {
    return {
      href: `/products/entry/communities/${community.id}`,
      label: "Open",
      variant: "secondary" as const,
    };
  }

  if (setupState.label === "Needs attention") {
    return {
      href: `/products/entry/communities/${community.id}`,
      label: "Review",
      variant: "primary" as const,
    };
  }

  return {
    href: `/products/entry/communities/${community.id}`,
    label: "Continue setup",
    variant: "primary" as const,
  };
}

function getSetupChipClass(tone: ReturnType<typeof getSetupState>["tone"]) {
  if (tone === "success") {
    return "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200";
  }

  return "border-amber-400/20 bg-amber-500/[0.08] text-amber-200";
}

function StatusChip({
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

function FeatureChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[4px] border border-violet-400/15 bg-violet-500/[0.08] px-1.5 py-0.5 text-[11px] font-medium leading-4 text-violet-100">
      {children}
    </span>
  );
}

export function CommunityList({ communities }: CommunityListProps) {
  const router = useRouter();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingCommunityAction | null>(
    null,
  );
  const [confirmationText, setConfirmationText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const expectedConfirmation = pendingAction?.nextIsActive
    ? "REACTIVAR"
    : "DESACTIVAR";
  const canSubmit = confirmationText.trim().toUpperCase() === expectedConfirmation;

  function openStatusModal(community: CommunityListItem, nextIsActive: boolean) {
    setOpenMenuId(null);
    setErrorMessage(null);
    setConfirmationText("");
    setPendingAction({ community, nextIsActive });
  }

  function closeStatusModal() {
    if (isPending) {
      return;
    }

    setPendingAction(null);
    setConfirmationText("");
    setErrorMessage(null);
  }

  function submitStatusChange() {
    if (!pendingAction || !canSubmit) {
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      const result = await setCommunityActiveStatusAction(
        pendingAction.community.id,
        pendingAction.nextIsActive,
      );

      if (!result.success) {
        setErrorMessage(result.error ?? "Could not update the community status.");
        return;
      }

      setPendingAction(null);
      setConfirmationText("");
      router.refresh();
    });
  }

  return (
    <>
      {openMenuId ? (
        <button
          type="button"
          aria-label="Close community menu"
          className="fixed inset-0 z-30 cursor-default bg-black/30"
          onClick={() => setOpenMenuId(null)}
        />
      ) : null}

      <section className="overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]">
        <div className="overflow-x-auto">
          <div className="min-w-[1240px]">
            <div className="grid grid-cols-[minmax(340px,1.35fr)_minmax(310px,0.95fr)_minmax(360px,1fr)_168px] items-center gap-4 border-b border-[var(--console-border)] bg-white/[0.015] px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                Community
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                Key stats
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                Setup status
              </p>
              <p className="text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                Actions
              </p>
            </div>

            <div className="divide-y divide-[var(--console-border)]">
              {communities.map((community) => {
                const cta = getCta(community);
                const setupState = getSetupState(community);
                const progressValue = getProgressValue(
                  community.completedTasks,
                  community.totalTasks,
                );
                const enabledFeatures = [
                  community.allowFrequentAccess ? "Frequent access" : null,
                  community.allowReservations ? "Reservations" : null,
                  community.allowMessages ? "Messages" : null,
                ].filter((feature): feature is string => feature !== null);
                const stats = [
                  { label: "Units", value: community.totalUnits },
                  { label: "Members", value: community.totalMembers },
                  { label: "Unit label", value: formatUnitLabel(community.unitLabel) },
                  {
                    label: "Queue pending",
                    value: community.activationPendingCount,
                    urgent: community.activationPendingCount > 0,
                  },
                ];

                return (
                  <article
                    key={community.id}
                    className={cn(
                      "relative grid grid-cols-[minmax(340px,1.35fr)_minmax(310px,0.95fr)_minmax(360px,1fr)_168px] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.025]",
                      openMenuId === community.id ? "z-40" : "z-0",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--console-border-strong)] bg-[var(--console-accent-subtle)] text-xs font-semibold text-violet-100">
                          {getInitials(community.name)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="truncate text-base font-semibold leading-5 text-white">
                              {community.name}
                            </h3>
                            <StatusChip
                              className={
                                community.isActive
                                  ? "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200"
                                  : "border-white/10 bg-white/[0.04] text-slate-200"
                              }
                            >
                              {community.isActive ? "Active" : "Inactive"}
                            </StatusChip>
                            <StatusChip className={getSetupChipClass(setupState.tone)}>
                              {setupState.label}
                            </StatusChip>
                          </div>

                          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--console-text-muted)]">
                            <MapPin className="h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
                            <span className="truncate">{community.city}</span>
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {enabledFeatures.length > 0 ? (
                              enabledFeatures.map((feature) => (
                                <FeatureChip key={feature}>{feature}</FeatureChip>
                              ))
                            ) : (
                              <span className="inline-flex items-center rounded-[4px] border border-white/10 bg-white/[0.025] px-1.5 py-0.5 text-[11px] font-medium leading-4 text-[var(--console-text-muted)]">
                                No optional modules
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 divide-x divide-[var(--console-border)]">
                      {stats.map((stat, index) => (
                        <div
                          key={stat.label}
                          className={cn(
                            "min-w-0 px-3",
                            index === 0 ? "pl-0" : "",
                            index === stats.length - 1 ? "pr-0" : "",
                          )}
                        >
                          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                            {stat.label}
                          </p>
                          <p
                            className={cn(
                              "mt-2 truncate text-lg font-semibold leading-6 text-white",
                              stat.urgent ? "text-amber-300" : "",
                            )}
                          >
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-5 text-white">
                            Setup status: {setupState.label}
                          </p>
                          <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                            {community.completedTasks} / {community.totalTasks || 0} tasks
                          </p>
                        </div>
                        <span className="shrink-0 pt-5 text-xs text-[var(--console-text-muted)]">
                          {progressValue}%
                        </span>
                      </div>

                      <div className="mt-2 h-1 rounded-full bg-white/[0.08]">
                        <div
                          className={cn("h-1 rounded-full", setupState.progressTone)}
                          style={{
                            width: getProgressWidth(
                              community.completedTasks,
                              community.totalTasks,
                            ),
                          }}
                        />
                      </div>

                      <p className="mt-2 truncate text-xs leading-5 text-[var(--console-text-muted)]">
                        Next step: {getOnboardingNextStepLabel(community.nextStepKey)}
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={cta.href}
                        className={cn(
                          "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50",
                          cta.variant === "primary"
                            ? "border border-transparent bg-[var(--console-accent-subtle)] text-violet-100 hover:bg-violet-500/20"
                            : "border border-[var(--console-border)] bg-white/[0.025] text-slate-100 hover:bg-white/[0.05]",
                        )}
                      >
                        {cta.label}
                      </Link>

                      <div className="relative">
                        <button
                          type="button"
                          aria-expanded={openMenuId === community.id}
                          aria-label={`More options for ${community.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                          onClick={() =>
                            setOpenMenuId((current) =>
                              current === community.id ? null : community.id,
                            )
                          }
                        >
                          <MoreVertical className="h-4 w-4 stroke-[1.75]" />
                        </button>

                        {openMenuId === community.id ? (
                          <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
                            <Link
                              href={cta.href}
                              className="block rounded-md px-3 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.05] hover:text-white"
                              onClick={() => setOpenMenuId(null)}
                            >
                              Open community
                            </Link>
                            <Link
                              href={`/products/entry/communities/${community.id}/users`}
                              className="block rounded-md px-3 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.05] hover:text-white"
                              onClick={() => setOpenMenuId(null)}
                            >
                              Manage users
                            </Link>
                            <button
                              type="button"
                              className={cn(
                                "w-full rounded-md px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-white/[0.05]",
                                community.isActive
                                  ? "text-rose-300 hover:text-rose-200"
                                  : "text-emerald-300 hover:text-emerald-200",
                              )}
                              onClick={() => openStatusModal(community, !community.isActive)}
                            >
                              {community.isActive
                                ? "Deactivate community"
                                : "Reactivate community"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {pendingAction ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-lg border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                  Community status
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {pendingAction.nextIsActive
                    ? "Reactivate community?"
                    : "Deactivate community?"}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-md border border-[var(--console-border)] bg-white/[0.025] px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.05]"
                onClick={closeStatusModal}
                disabled={isPending}
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
              <p className="text-base font-semibold text-white">
                {pendingAction.community.name}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
                {pendingAction.nextIsActive
                  ? "Reactivating this community will restore only the users and assignments that were disabled by the community suspension. Users disabled manually will remain inactive."
                  : "This will block access for residents, guards, and community admins. Data will not be deleted, and you can reactivate the community later from Minerva Console."}
              </p>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-slate-200">
                Type {expectedConfirmation} to confirm
              </span>
              <input
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                className="mt-2 w-full rounded-md border border-[var(--console-border)] bg-[var(--console-surface)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/40"
                placeholder={expectedConfirmation}
                disabled={isPending}
              />
            </label>

            {errorMessage ? (
              <p className="mt-4 rounded-md border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={closeStatusModal}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={pendingAction.nextIsActive ? "primary" : "danger"}
                onClick={submitStatusChange}
                disabled={!canSubmit || isPending}
              >
                {isPending
                  ? "Working..."
                  : pendingAction.nextIsActive
                    ? "Reactivate community"
                    : "Deactivate community"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
