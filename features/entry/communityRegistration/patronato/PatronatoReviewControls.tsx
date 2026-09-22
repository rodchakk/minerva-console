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
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">Patronato review</Badge>
            <span className="text-xs text-[var(--text-muted)]">
              {reviewedCount} waiting · {confirmedCount} approved · {processedCount} sent to Activation Queue
            </span>
          </div>
          <h2 className="mt-2 text-base font-semibold text-white">
            Mobile approval link
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
            Only units marked Ready for Patronato appear on this link. Generating a
            new link revokes the previous active Patronato link.
          </p>
        </div>

        <form action={action}>
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="hidden" name="community_id" value={communityId} />
          <Button type="submit" disabled={pending || !canShare}>
            {pending ? "Generating..." : "Generate secure Patronato link"}
          </Button>
        </form>
      </div>

      {state && !state.success ? (
        <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {state.error}
        </p>
      ) : null}

      {state?.success ? (
        <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              readOnly
              value={state.data.reviewUrl}
              className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-black/20 px-3 text-sm text-white"
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
