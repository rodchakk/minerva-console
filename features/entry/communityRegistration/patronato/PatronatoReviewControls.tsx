"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  createPatronatoReviewLink,
  type CreatePatronatoReviewLinkResult,
} from "@/features/entry/communityRegistration/patronato/adminActions";

const initialState: CreatePatronatoReviewLinkResult | null = null;

export function PatronatoReviewControls({
  campaignId,
  campaignStatus,
  communityId,
  confirmedCount,
  processedCount,
  reviewedCount,
}: {
  campaignId: string;
  campaignStatus: string;
  communityId: string;
  confirmedCount: number;
  processedCount: number;
  reviewedCount: number;
}) {
  const [state, action, pending] = useActionState(
    createPatronatoReviewLink,
    initialState,
  );
  const [copied, setCopied] = useState(false);
  const canShare = ["open", "review"].includes(campaignStatus);

  async function copyReviewUrl() {
    if (!state?.success) return;
    await navigator.clipboard.writeText(state.data.reviewUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <section className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF]">
      <div className="flex flex-col gap-4 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#BEB4FF]">
              Patronato review
            </span>
            <span className="text-[11px] text-[#8F879D]">
              {reviewedCount} waiting · {confirmedCount} approved · {processedCount} in Activation Queue
            </span>
          </div>
          <div className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
            <h2 className="text-sm font-semibold text-white">Mobile approval link</h2>
            <p className="text-xs text-[#A9A3B2]">
              Only Ready for Patronato units are shared. A new link revokes the previous active link.
            </p>
          </div>
        </div>

        <form action={action} className="shrink-0">
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="hidden" name="community_id" value={communityId} />
          <Button type="submit" disabled={pending || !canShare}>
            {pending ? "Generating..." : "Generate Patronato link"}
          </Button>
        </form>
      </div>

      {state && !state.success ? (
        <p className="mx-4 mb-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {state.error}
        </p>
      ) : null}

      {state?.success ? (
        <div className="mx-4 mb-4 rounded-lg border border-emerald-400/20 bg-emerald-500/[0.07] p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              readOnly
              value={state.data.reviewUrl}
              className="h-9 min-w-0 flex-1 rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] px-3 text-xs text-white shadow-[inset_0_1px_0_#141119] outline-none"
              aria-label="Patronato review URL"
            />
            <Button type="button" variant="secondary" onClick={copyReviewUrl}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-emerald-100/80">
            Expires {new Date(state.data.expiresAt).toLocaleDateString()}.
            {state.data.revokedPreviousCount > 0
              ? " Previous active link revoked."
              : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}
