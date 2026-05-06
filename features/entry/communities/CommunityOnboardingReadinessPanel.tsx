"use client";

import { useMemo, useState, useTransition } from "react";
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

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  return "Available";
}

function getTaskActionHref(communityId: string, key: string) {
  switch (key) {
    case "activation_queue":
    case "review_activation_queue":
      return `/products/entry/activation?community_id=${communityId}`;
    case "facilities":
      return "#facilities-summary";
    case "units":
      return "#units-snapshot";
    case "admins":
    case "residents":
      return "#users-summary";
    default:
      return "#setup-status";
  }
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

  const canMarkActivationQueueReviewed =
    !!activationQueueTask && !activationQueueTask.done;
  const canComplete = !!detail && detail.blockers.length === 0;
  const isComplete = detail?.onboardingStatus === "complete_active";

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
        id="setup-status"
        className="rounded-[30px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(112,104,255,0.12),rgba(17,24,39,0.9))] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.2)]"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
          Setup status
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white">
          Operational readiness
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          {progressLabel}
        </p>
        <p className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Detailed readiness checks are not available right now.
        </p>
      </section>
    );
  }

  return (
    <section
      id="setup-status"
      className="rounded-[30px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(112,104,255,0.12),rgba(17,24,39,0.9))] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.2)]"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
        Setup tasks
      </p>
      <h3 className="mt-2 text-xl font-semibold text-white">
        Operational readiness
      </h3>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
        {detail.completedTasks} / {detail.totalTasks} tasks completed. Next step:{" "}
        {getOnboardingNextStepLabel(nextStepKey)}.
      </p>

      {detail.blockers.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-amber-100">
            Readiness blockers
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-50/90">
            {detail.blockers.map((blocker) => (
              <li key={blocker}>• {blocker}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
          No readiness blockers detected.
        </p>
      )}

      <div className="mt-5 space-y-3">
        {detail.tasks.map((task) => (
          <div
            key={task.key}
            className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid h-6 w-6 place-items-center rounded-full border text-xs ${
                    task.done
                      ? "border-emerald-400/40 bg-emerald-400/12 text-emerald-300"
                      : "border-white/15 bg-white/5 text-[var(--text-muted)]"
                  }`}
                >
                  {task.done ? "✓" : ""}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{task.label}</p>
                  {Object.entries(task.summary).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(task.summary)
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <span
                            key={key}
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[var(--text-muted)]"
                          >
                            {key.replaceAll("_", " ")}: {formatValue(value)}
                          </span>
                        ))}
                    </div>
                  ) : null}
                </div>
              </div>
              {!task.done ? (
                <a
                  href={getTaskActionHref(communityId, task.key)}
                  className="shrink-0 text-xs font-semibold text-violet-200 transition hover:text-white"
                >
                  Review →
                </a>
              ) : (
                <span className="shrink-0 text-xs font-semibold text-emerald-200">
                  Done
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {result ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
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

      <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
        {canMarkActivationQueueReviewed ? (
          <Button
            type="button"
            variant="secondary"
            onClick={handleMarkReviewed}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? "Updating..." : "Mark activation queue reviewed"}
          </Button>
        ) : null}

        {!isComplete ? (
          <>
            <textarea
              value={completionNote}
              onChange={(event) => setCompletionNote(event.target.value)}
              rows={3}
              placeholder="Optional completion note..."
              className="w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-300/50"
            />
            <Button
              type="button"
              onClick={handleComplete}
              disabled={isPending || !canComplete}
              title={
                canComplete
                  ? "Complete onboarding and activate this community."
                  : "Resolve blockers before completing onboarding."
              }
              className="w-full"
            >
              {isPending ? "Completing..." : "Complete onboarding"}
            </Button>
          </>
        ) : (
          <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
            Community onboarding is complete and active.
          </p>
        )}
      </div>
    </section>
  );
}
