"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { setCommunityActiveStatusAction } from "@/features/entry/communities/statusActions";
import type { CommunityListItem } from "@/features/entry/communities/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";

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
    progressTone: "bg-[var(--primary)]",
  };
}

function getProgressWidth(completed: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.round((completed / total) * 100))}%`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "MC";
}

function getCta(community: CommunityListItem) {
  const setupState = getSetupState(community);

  if (community.onboardingStatus === "complete_active") {
    return {
      href: `/products/entry/communities/${community.id}`,
      label: "Open",
    };
  }

  if (setupState.label === "Needs attention") {
    return {
      href: `/products/entry/communities/${community.id}`,
      label: "Review",
    };
  }

  return {
    href: `/products/entry/communities/${community.id}`,
    label: "Continue setup",
  };
}

export function CommunityList({ communities }: CommunityListProps) {
  const router = useRouter();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingCommunityAction | null>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const expectedConfirmation = pendingAction?.nextIsActive ? "REACTIVAR" : "DESACTIVAR";
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
      <div className="space-y-4">
        {communities.map((community) => {
          const cta = getCta(community);
          const setupState = getSetupState(community);
          const enabledFeatures = [
            community.allowFrequentAccess ? "Frequent access" : null,
            community.allowReservations ? "Reservations" : null,
            community.allowMessages ? "Messages" : null,
          ].filter((feature): feature is string => feature !== null);

          return (
            <article
              key={community.id}
              className="rounded-[30px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(17,24,39,0.92),rgba(11,16,28,0.96))] p-5 shadow-[0_20px_55px_rgba(2,6,23,0.24)] backdrop-blur sm:p-6"
            >
              <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.95fr)_auto] xl:items-center">
                <div className="flex min-w-0 gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[linear-gradient(180deg,rgba(112,104,255,0.22),rgba(26,35,64,0.96))] text-xl font-semibold text-violet-100 ring-1 ring-inset ring-violet-400/20">
                    {getInitials(community.name)}
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div>
                      <h3 className="truncate text-2xl font-semibold text-white">
                        {community.name}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        ◌ {community.city}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={community.isActive ? "success" : "default"}>
                        {community.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge tone={setupState.tone}>{setupState.label}</Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {enabledFeatures.length > 0 ? (
                        enabledFeatures.map((feature) => (
                          <Badge key={feature} tone="info">
                            {feature}
                          </Badge>
                        ))
                      ) : (
                        <Badge tone="default">No optional modules enabled</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[22px] border border-white/8 bg-[rgba(9,12,24,0.54)] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Total units
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {community.totalUnits}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-[rgba(9,12,24,0.54)] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Total members
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {community.totalMembers}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-[rgba(9,12,24,0.54)] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Unit label
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {community.unitLabel}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-[rgba(9,12,24,0.54)] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Queue pending
                    </p>
                    <p
                      className={`mt-2 text-2xl font-semibold ${
                        community.activationPendingCount > 0
                          ? "text-amber-300"
                          : "text-white"
                      }`}
                    >
                      {community.activationPendingCount}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-4 xl:min-w-[320px]">
                  <div className="rounded-[24px] border border-white/8 bg-[rgba(9,12,24,0.58)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Setup status: {setupState.label}
                        </p>
                        {community.onboardingStatus === "complete_active" ? (
                          <p className="mt-1 text-sm text-[var(--text-muted)]">
                            All tasks completed
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-[var(--text-muted)]">
                            {community.completedTasks} / {community.totalTasks || 0} tasks
                            complete
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-medium text-[var(--text-muted)]">
                        {community.completedTasks} / {community.totalTasks || 0} tasks
                      </span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/8">
                      <div
                        className={`h-2 rounded-full transition-[width] ${setupState.progressTone}`}
                        style={{
                          width: getProgressWidth(
                            community.completedTasks,
                            community.totalTasks,
                          ),
                        }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-[var(--text-muted)]">
                      Next step: {getOnboardingNextStepLabel(community.nextStepKey)}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <Link href={cta.href}>
                      <Button>{cta.label}</Button>
                    </Link>
                    <div className="relative">
                      <button
                        type="button"
                        aria-expanded={openMenuId === community.id}
                        aria-label={`More options for ${community.name}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/6 text-slate-200 transition hover:bg-white/10 hover:text-white"
                        onClick={() =>
                          setOpenMenuId((current) =>
                            current === community.id ? null : community.id,
                          )
                        }
                      >
                        ⋮
                      </button>

                      {openMenuId === community.id ? (
                        <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#111827] p-2 shadow-[0_22px_60px_rgba(0,0,0,0.42)]">
                          <Link
                            href={cta.href}
                            className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/8 hover:text-white"
                            onClick={() => setOpenMenuId(null)}
                          >
                            Open community
                          </Link>
                          <button
                            type="button"
                            className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-white/8 ${
                              community.isActive
                                ? "text-rose-300 hover:text-rose-200"
                                : "text-emerald-300 hover:text-emerald-200"
                            }`}
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
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {pendingAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[30px] border border-white/10 bg-[#0f172a] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
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
                className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                onClick={closeStatusModal}
                disabled={isPending}
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-base font-semibold text-white">
                {pendingAction.community.name}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
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
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60"
                placeholder={expectedConfirmation}
                disabled={isPending}
              />
            </label>

            {errorMessage ? (
              <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
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
