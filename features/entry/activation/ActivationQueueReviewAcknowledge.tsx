"use client";

import { CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  markActivationQueueReviewedAction,
  type OnboardingActionResult,
} from "@/features/entry/communities/onboardingActions";

type ActivationQueueReviewAcknowledgeProps = {
  communityId: string;
  pendingCount: number;
  reviewedAt: string;
};

export function ActivationQueueReviewAcknowledge({
  communityId,
  pendingCount,
  reviewedAt,
}: ActivationQueueReviewAcknowledgeProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<OnboardingActionResult | null>(null);

  function handleMarkReviewed() {
    setResult(null);
    startTransition(async () => {
      setResult(await markActivationQueueReviewedAction(communityId));
    });
  }

  return (
    <section className="rounded-xl border border-amber-400/20 bg-amber-500/[0.065] px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/12 text-amber-300">
            <CheckCircle2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-100">
              Queue review pending
            </p>
            <p className="mt-0.5 text-xs leading-5 text-amber-50/70">
              Review the prepared residents, then acknowledge the queue. Pending
              rows can remain for progressive activation.
            </p>
            <p className="mt-1 text-[11px] text-amber-100/55">
              {pendingCount} pending activation{pendingCount === 1 ? "" : "s"}
              {reviewedAt ? ` · Last reviewed: ${reviewedAt}` : ""}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={handleMarkReviewed}
          disabled={isPending}
          className="shrink-0"
        >
          {isPending ? "Updating..." : "Mark queue reviewed"}
        </Button>
      </div>

      {result ? (
        <p
          className={`mt-2 text-xs font-semibold ${
            result.success ? "text-emerald-200" : "text-rose-100"
          }`}
        >
          {result.success ? result.message : result.error}
        </p>
      ) : null}
    </section>
  );
}
