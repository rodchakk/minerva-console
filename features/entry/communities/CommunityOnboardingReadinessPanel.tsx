"use client";

import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import type { CommunityOnboardingDetail } from "@/features/entry/communities/queries";
import {
  completeCommunityOnboardingAction,
  markActivationQueueReviewedAction,
  type OnboardingActionResult,
} from "@/features/entry/communities/onboardingActions";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";
import { cn } from "@/lib/supabase/utils";

type CommunityOnboardingReadinessPanelProps = {
  communityId: string;
  detail: CommunityOnboardingDetail | null;
  nextStepKey: string;
  progressLabel: string;
};

type RefinedTask = {
  description: string;
  done: boolean;
  key: string;
  label: string;
  statusLabel: string;
  statusTone: "success" | "warning" | "info";
};

function getTaskDescription(key: string) {
  switch (key) {
    case "details":
      return "Basic community information and settings.";
    case "features":
      return "Essential ENTRY features are configured.";
    case "units":
      return "Community units and buildings are ready.";
    case "admins":
    case "staff":
      return "At least one community administrator is assigned.";
    case "facilities":
      return "Facilities and reservation settings are configured.";
    case "activation_queue":
    case "review_activation_queue":
      return "Pending resident activations have been reviewed.";
    case "final_review":
      return "Run the final readiness validation to complete onboarding.";
    default:
      return "Review this onboarding requirement.";
  }
}

function getTaskActionHref(communityId: string, key: string) {
  switch (key) {
    case "activation_queue":
    case "review_activation_queue":
      return `/products/entry/activation?community_id=${communityId}`;
    case "facilities":
      return `/products/entry/communities/${communityId}/facilities/new`;
    case "units":
      return `/products/entry/communities/${communityId}/units/new`;
    case "admins":
    case "staff":
      return `/products/entry/communities/${communityId}/staff`;
    case "residents":
      return `/products/entry/communities/${communityId}/users`;
    default:
      return null;
  }
}

function getTaskStatus(
  task: CommunityOnboardingDetail["tasks"][number],
  nextStepKey: string,
) {
  if (task.done) {
    return {
      statusLabel: "Complete",
      statusTone: "success" as const,
    };
  }

  if (
    task.key === nextStepKey ||
    (task.key === "admins" && nextStepKey === "staff")
  ) {
    return {
      statusLabel: "Current",
      statusTone: "warning" as const,
    };
  }

  return {
    statusLabel: "Waiting",
    statusTone: "info" as const,
  };
}

function getProgressPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: RefinedTask["statusTone"];
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-[4px] border px-2 py-1 text-[10px] font-semibold",
        tone === "success" &&
          "border-[rgba(103,215,165,0.20)] bg-[rgba(103,215,165,0.06)] text-[#8EE2B9]",
        tone === "warning" &&
          "border-[rgba(246,201,65,0.22)] bg-[rgba(246,201,65,0.06)] text-[#F2D77B]",
        tone === "info" &&
          "border-white/10 bg-white/[0.025] text-[#A9A3B2]",
      )}
    >
      {label}
    </span>
  );
}

function DimensionalButton({
  children,
  disabled,
  onClick,
  primary = true,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-[7px] border px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF] disabled:cursor-not-allowed disabled:opacity-45",
        primary
          ? "border-[#120539] bg-[#7553FF] shadow-[0_2px_0_#120539]"
          : "border-[#141119] bg-[#2E2936] shadow-[0_2px_0_#141119]",
      )}
    >
      {children}
    </button>
  );
}

export function CommunityOnboardingReadinessPanel({
  communityId,
  detail,
  nextStepKey,
  progressLabel,
}: CommunityOnboardingReadinessPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<OnboardingActionResult | null>(null);
  const [completionNote, setCompletionNote] = useState("");

  const activationQueueTask = useMemo(
    () =>
      detail?.tasks.find((task) =>
        ["activation_queue", "review_activation_queue"].includes(task.key),
      ) ?? null,
    [detail],
  );

  const refinedTasks = useMemo<RefinedTask[]>(() => {
    if (!detail) return [];

    return detail.tasks.map((task) => {
      const status = getTaskStatus(task, nextStepKey);

      return {
        description: getTaskDescription(task.key),
        done: task.done,
        key: task.key,
        label: task.label,
        statusLabel: status.statusLabel,
        statusTone: status.statusTone,
      };
    });
  }, [detail, nextStepKey]);

  const canMarkActivationQueueReviewed =
    !!activationQueueTask && !activationQueueTask.done;
  const canComplete = !!detail && detail.blockers.length === 0;
  const isComplete = detail?.onboardingStatus === "complete_active";
  const completedTasks = detail?.completedTasks ?? 0;
  const totalTasks = detail?.totalTasks ?? 0;
  const progressPercent = getProgressPercent(completedTasks, totalTasks);

  function handleMarkReviewed() {
    setResult(null);

    startTransition(async () => {
      const actionResult = await markActivationQueueReviewedAction(communityId);
      setResult(actionResult);
    });
  }

  function handleComplete() {
    setResult(null);

    startTransition(async () => {
      const actionResult = await completeCommunityOnboardingAction({
        communityId,
        completionNote,
      });
      setResult(actionResult);
    });
  }

  if (!detail) {
    return (
      <section className="relative rounded-[10px] border border-[#141119] bg-[#24202B] p-5 before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#BEB4FF]">
          Setup
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Operational readiness
        </h2>
        <p className="mt-2 text-sm text-[#A9A3B2]">{progressLabel}</p>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]">
      <header className="grid gap-4 border-b border-[#141119] px-5 py-4 lg:grid-cols-[minmax(0,1fr)_270px] lg:items-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#BEB4FF]">
            Community setup
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
            {completedTasks} / {totalTasks} tasks complete
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#A9A3B2]">
            Detailed onboarding checks live here so the community overview stays operational and lightweight.
          </p>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-white/[0.012] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-white">Overall progress</span>
            <span className="text-xs font-semibold text-[#D8D1FF]">
              {progressPercent}%
            </span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/[0.08]">
            <div
              className="h-1.5 rounded-full bg-[#7553FF]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-[#8F879D]">
            Next: {getOnboardingNextStepLabel(nextStepKey)}
          </p>
        </div>
      </header>

      {detail.blockers.length > 0 ? (
        <div className="border-b border-[#141119] bg-[rgba(246,201,65,0.05)] px-5 py-3">
          <p className="text-xs font-semibold text-[#F2D77B]">
            {detail.blockers.length} readiness blocker
            {detail.blockers.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#D8CFAD]">
            {detail.blockers.join(" · ")}
          </p>
        </div>
      ) : (
        <div className="border-b border-[#141119] bg-[rgba(103,215,165,0.04)] px-5 py-3">
          <p className="text-xs font-semibold text-[#8EE2B9]">
            No readiness blockers detected
          </p>
        </div>
      )}

      <div>
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3 border-b border-[#141119] bg-[#1F1B26] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D] md:grid-cols-[44px_minmax(0,1fr)_minmax(220px,.8fr)_120px]">
          <span className="hidden md:block">Step</span>
          <span>Requirement</span>
          <span className="hidden md:block">Description</span>
          <span className="text-right">Status</span>
        </div>

        {refinedTasks.map((task, index) => {
          const href = getTaskActionHref(communityId, task.key);

          return (
            <div
              key={task.key}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_120px] gap-3 border-b border-[#141119] px-5 py-3.5 last:border-b-0 md:grid-cols-[44px_minmax(0,1fr)_minmax(220px,.8fr)_120px] md:items-center",
                !task.done &&
                  task.statusTone === "warning" &&
                  "bg-[rgba(117,83,255,0.045)] shadow-[inset_2px_0_0_#7553FF]",
              )}
            >
              <div className="hidden md:block">
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full border text-[10px] font-semibold",
                    task.done
                      ? "border-[rgba(103,215,165,0.25)] bg-[rgba(103,215,165,0.07)] text-[#8EE2B9]"
                      : task.statusTone === "warning"
                        ? "border-[#7553FF] bg-[rgba(117,83,255,0.08)] text-[#D8D1FF]"
                        : "border-white/15 bg-white/[0.02] text-[#8F879D]",
                  )}
                >
                  {task.done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{task.label}</p>
                <p className="mt-1 text-[11px] leading-4 text-[#8F879D] md:hidden">
                  {task.description}
                </p>
              </div>

              <p className="hidden text-xs leading-5 text-[#A9A3B2] md:block">
                {task.description}
              </p>

              <div className="flex items-center justify-end gap-2">
                {href && !task.done ? (
                  <Link
                    href={href}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#CFC7FF] hover:text-white"
                  >
                    Open
                    <ChevronRight className="size-3" aria-hidden />
                  </Link>
                ) : null}
                <StatusChip label={task.statusLabel} tone={task.statusTone} />
              </div>
            </div>
          );
        })}
      </div>

      {result ? (
        <div
          className={cn(
            "border-t border-[#141119] px-5 py-3 text-xs font-medium",
            result.success
              ? "bg-[rgba(103,215,165,0.05)] text-[#8EE2B9]"
              : "bg-[rgba(255,102,126,0.06)] text-[#FFC1CB]",
          )}
        >
          {result.success ? result.message : result.error}
        </div>
      ) : null}

      <footer className="grid gap-4 border-t border-[#141119] bg-black/[0.035] px-5 py-4 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-end">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
            Completion note
          </label>
          <textarea
            value={completionNote}
            onChange={(event) => setCompletionNote(event.target.value)}
            rows={3}
            placeholder="Optional completion notes..."
            className="mt-2 w-full resize-none rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] px-3 py-2.5 text-sm text-white shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
          />

          {canMarkActivationQueueReviewed ? (
            <div className="mt-3">
              <DimensionalButton
                primary={false}
                onClick={handleMarkReviewed}
                disabled={isPending}
              >
                {isPending ? "Updating..." : "Mark activation queue reviewed"}
              </DimensionalButton>
            </div>
          ) : null}
        </div>

        <div>
          {!isComplete ? (
            <>
              <p className="mb-3 text-xs leading-5 text-[#A9A3B2]">
                {canComplete
                  ? "All readiness checks are clear. Completing onboarding will activate the community."
                  : "Resolve readiness blockers before completing onboarding."}
              </p>
              <DimensionalButton
                onClick={handleComplete}
                disabled={isPending || !canComplete}
                title={
                  canComplete
                    ? "Complete onboarding and activate this community."
                    : "Resolve blockers before completing onboarding."
                }
              >
                {isPending ? "Completing..." : "Complete onboarding"}
              </DimensionalButton>
            </>
          ) : (
            <div className="rounded-lg border border-[rgba(103,215,165,0.20)] bg-[rgba(103,215,165,0.06)] px-4 py-3 text-sm font-semibold text-[#8EE2B9]">
              Community onboarding is complete and active.
            </div>
          )}
        </div>
      </footer>
    </section>
  );
}
