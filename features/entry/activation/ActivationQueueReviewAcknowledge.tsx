"use client";

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
    <section className="rounded-[26px] border border-amber-400/18 bg-amber-500/8 p-4 shadow-[0_16px_40px_rgba(2,6,23,0.14)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-100">
            Activation queue review
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-50/80">
            Mark this queue as reviewed after checking the prepared residents.
            Pending rows can remain for progressive activation.
          </p>
          <p className="mt-2 text-xs text-amber-100/70">
            Pending activations: {pendingCount}
            {reviewedAt ? ` - Last reviewed: ${reviewedAt}` : ""}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={handleMarkReviewed}
          disabled={isPending}
          className="shrink-0"
        >
          {isPending ? "Updating..." : "Mark activation queue reviewed"}
        </Button>
      </div>

      {result ? (
        <p
          className={`mt-3 text-sm font-semibold ${
            result.success ? "text-emerald-200" : "text-rose-100"
          }`}
        >
          {result.success ? result.message : result.error}
        </p>
      ) : null}
    </section>
  );
}
