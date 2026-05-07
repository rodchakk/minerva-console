"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CommunityOnboardingDetail } from "@/features/entry/communities/queries";
import {
  completeCommunityOnboardingAction,
  markActivationQueueReviewedAction,
  type OnboardingActionResult,
} from "@/features/entry/communities/onboardingActions";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";

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
  summary: Record<string, unknown>;
};

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  return "Available";
}

function getTaskDescription(key: string) {
  switch (key) {
    case "details":
      return "Basic community information and settings.";
    case "features":
      return "Enabled essential community features.";
    case "units":
      return "All units and buildings have been added.";
    case "admins":
    case "staff":
      return "At least one admin is assigned.";
    case "facilities":
      return "Facilities and amenities are set up.";
    case "activation_queue":
    case "review_activation_queue":
      return "All pending activations have been reviewed.";
    case "final_review":
      return "Run final validation to complete onboarding.";
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
      return `/products/entry/users?community_id=${communityId}`;
    case "final_review":
      return "#completion-actions";
    default:
      return "#setup-progress";
  }
}

function getProgressPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

function getTaskStatus(
  task: CommunityOnboardingDetail["tasks"][number],
  nextStepKey: string,
) {
  if (task.done) {
    return { statusLabel: "Done", statusTone: "success" as const };
  }

  if (task.key === nextStepKey || (task.key === "admins" && nextStepKey === "staff")) {
    return { statusLabel: "Pending", statusTone: "warning" as const };
  }

  return { statusLabel: "Review", statusTone: "info" as const };
}

function TaskActionLink({ href, tone }: { href: string; tone: RefinedTask["statusTone"] }) {
  const className =
    tone === "warning"
      ? "text-xs font-semibold text-amber-200 transition hover:text-white"
      : "text-xs font-semibold text-violet-200 transition hover:text-white";

  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        Review {"->"}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      Review {"->"}
    </Link>
  );
}

function TaskStatusIcon({ task }: { task: RefinedTask }) {
  if (task.done) {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-sm text-emerald-300">
        ✓
      </span>
    );
  }

  if (task.statusTone === "warning") {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-2xl border border-amber-400/20 bg-amber-500/10 text-sm text-amber-300">
        !
      </span>
    );
  }

  return (
    <span className="grid h-8 w-8 place-items-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-sm text-violet-200">
      →
    </span>
  );
}

function ActivationQueueDetails({
  detail,
  task,
}: {
  detail: CommunityOnboardingDetail;
  task: RefinedTask;
}) {
  if (!["activation_queue", "review_activation_queue"].includes(task.key)) {
    return null;
  }

  const pendingCount = formatValue(
    task.summary.pending_activations ??
      task.summary.pending_count ??
      task.summary.pending,
  );
  const reviewedAt = formatValue(
    detail.activationQueueReviewedAt || task.summary.last_reviewed_at,
  );
  const reviewedBy = formatValue(task.summary.last_reviewed_by);

  return (
    <div className="mt-4 grid gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] p-4 md:grid-cols-3">
      <div className="rounded-2xl border border-white/8 bg-[var(--surface-strong)] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Pending activations
        </p>
        <p className="mt-2 text-lg font-semibold text-white">{pendingCount}</p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-[var(--surface-strong)] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Last reviewed by
        </p>
        <p className="mt-2 text-sm font-semibold text-white">{reviewedBy}</p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-[var(--surface-strong)] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Last reviewed
        </p>
        <p className="mt-2 text-sm font-semibold text-white">{reviewedAt}</p>
      </div>
    </div>
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
        summary: task.summary,
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
      <section
        id="setup-progress"
        className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(112,104,255,0.08),rgba(10,16,30,0.94))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.24)]"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
          Setup progress
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          Operational readiness
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          {progressLabel}
        </p>
      </section>
    );
  }

  return (
    <section
      id="setup-progress"
      className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(112,104,255,0.08),rgba(10,16,30,0.94))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.24)]"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
            Setup progress
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {completedTasks} / {totalTasks} tasks completed
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Complete the remaining readiness checks before finishing onboarding.
          </p>
        </div>

        <div className="rounded-[26px] border border-white/8 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Overall progress</p>
            <Badge tone="info">{progressPercent}%</Badge>
          </div>
          <div className="mt-4 h-3 rounded-full bg-white/8">
            <div
              className="h-3 rounded-full bg-[linear-gradient(90deg,var(--primary),rgba(140,129,255,0.95))]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Next step: {getOnboardingNextStepLabel(nextStepKey)}.
          </p>
        </div>
      </div>

      {detail.blockers.length > 0 ? (
        <div className="mt-6 rounded-[24px] border border-amber-400/20 bg-amber-500/10 px-4 py-4">
          <p className="text-sm font-semibold text-amber-100">
            Readiness blockers
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-50/90">
            {detail.blockers.map((blocker) => (
              <li key={blocker}>• {blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-[28px] border border-white/8 bg-[rgba(6,10,22,0.36)]">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px] gap-4 border-b border-white/8 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <p>Task</p>
          <p>Description</p>
          <p className="text-right">Status</p>
        </div>

        <div className="divide-y divide-white/7">
          {refinedTasks.map((task) => (
            <div key={task.key} className="px-5 py-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px] xl:items-center">
                <div className="flex items-start gap-3">
                  <TaskStatusIcon task={task} />
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{task.label}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)] xl:hidden">
                      {task.description}
                    </p>
                    {!task.done ? (
                      <div className="mt-2 xl:hidden">
                        <TaskActionLink
                          href={getTaskActionHref(communityId, task.key)}
                          tone={task.statusTone}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="hidden xl:block">
                  <p className="text-sm text-[var(--text-muted)]">{task.description}</p>
                </div>

                <div className="flex items-center justify-between gap-3 xl:justify-end">
                  {!task.done ? (
                    <TaskActionLink
                      href={getTaskActionHref(communityId, task.key)}
                      tone={task.statusTone}
                    />
                  ) : null}
                  <Badge tone={task.statusTone}>{task.statusLabel}</Badge>
                </div>
              </div>

              <ActivationQueueDetails detail={detail} task={task} />
            </div>
          ))}
        </div>
      </div>

      {result ? (
        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
            result.success
              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
              : "border-rose-400/20 bg-rose-500/10 text-rose-100"
          }`}
        >
          <p className="font-semibold">
            {result.success ? result.message : result.error}
          </p>
          {!result.success && result.blockers?.length ? (
            <ul className="mt-2 space-y-1">
              {result.blockers.map((blocker) => (
                <li key={blocker}>• {blocker}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div
        id="completion-actions"
        className="mt-6 grid gap-4 border-t border-white/10 pt-6 xl:grid-cols-[minmax(0,1fr)_300px]"
      >
        <div className="space-y-4">
          {canMarkActivationQueueReviewed ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handleMarkReviewed}
              disabled={isPending}
            >
              {isPending ? "Updating..." : "Mark activation queue reviewed"}
            </Button>
          ) : null}

          <textarea
            value={completionNote}
            onChange={(event) => setCompletionNote(event.target.value)}
            rows={4}
            placeholder="Optional completion notes..."
            className="w-full rounded-[24px] border border-white/10 bg-[var(--surface-strong)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-300/50"
          />
        </div>

        <div className="flex flex-col justify-end">
          {!isComplete ? (
            <Button
              type="button"
              onClick={handleComplete}
              disabled={isPending || !canComplete}
              title={
                canComplete
                  ? "Complete onboarding and activate this community."
                  : "Resolve blockers before completing onboarding."
              }
              className="min-h-14 w-full text-base"
            >
              {isPending ? "Completing..." : "Complete onboarding"}
            </Button>
          ) : (
            <p className="rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-200">
              Community onboarding is complete and active.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
