import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ActivationQueueReviewAcknowledge } from "@/features/entry/activation/ActivationQueueReviewAcknowledge";
import { ActivationQueueTable } from "@/features/entry/activation/ActivationQueueTable";
import { getActivationQueuePageData } from "@/features/entry/activation/actions";
import { LaunchCampaignButton } from "@/features/entry/onboardingCampaigns/LaunchCampaignButton";
import { getCampaignPreview } from "@/features/entry/onboardingCampaigns/actions";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ActivationQueuePage(
  props: PageProps<"/products/entry/activation">,
) {
  const searchParams = await props.searchParams;
  const selectedCommunityId = getSingleParam(searchParams.community_id);
  const [data, campaignPreview] = await Promise.all([
    getActivationQueuePageData({
      communityId: selectedCommunityId,
    }),
    getCampaignPreview(selectedCommunityId),
  ]);
  const selectedCommunity = data.communities.find(
    (community) => community.id === selectedCommunityId,
  );
  const showLaunchCampaign =
    Boolean(selectedCommunityId) &&
    campaignPreview.ready + campaignPreview.alreadyInvited > 0;

  return (
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-[2200px] -translate-x-1/2 space-y-3 lg:w-[calc(100vw-19rem)] 2xl:w-[calc(100vw-19.5rem)]">
      <PageHeader
        title="Activation Queue"
        description="Prepared resident records waiting for controlled activation."
        actions={
          <div className="flex flex-wrap gap-3">
            {selectedCommunity ? (
              <Link href={`/products/entry/communities/${selectedCommunity.id}`}>
                <Button variant="secondary">
                  <Building2 className="mr-2 h-4 w-4" aria-hidden />
                  Back to community details
                </Button>
              </Link>
            ) : null}
            {showLaunchCampaign ? (
              <LaunchCampaignButton
                communityId={selectedCommunityId}
                communityName={selectedCommunity?.name ?? ""}
                preview={campaignPreview}
              />
            ) : null}
          </div>
        }
      />

      <div className="inline-flex items-center rounded-full border border-amber-400/18 bg-amber-500/8 px-3 py-1.5 text-xs text-amber-100 shadow-[0_10px_26px_rgba(2,6,23,0.1)]">
        <span className="mr-2 text-amber-300">i</span>
        <p>
          Activation Queue prepares residents before account activation. PINs are
          temporary 7-day credentials.
        </p>
      </div>

      {!selectedCommunityId ? (
        <div className="space-y-5">
          <EmptyState
            title="Select a community"
            description="Choose a community to review prepared residents, queue status, and onboarding progress."
            actionHref="/products/entry/communities"
            actionLabel="Back to communities"
          />
          {data.communities.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.communities.map((community) => (
                <Link
                  key={community.id}
                  href={`/products/entry/activation?community_id=${community.id}`}
                  className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur transition hover:border-violet-400/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {community.name}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {community.city}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-slate-200">
                      {community.activationPendingCount} pending
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                    Next step: {getOnboardingNextStepLabel(community.nextStepKey)}
                  </p>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {data.progress?.activationQueueReviewRequired ? (
            <ActivationQueueReviewAcknowledge
              communityId={selectedCommunityId}
              pendingCount={data.progress.activationPendingCount}
              reviewedAt={data.progress.activationQueueReviewedAt}
            />
          ) : null}

          {data.rows.length > 0 ? (
            <ActivationQueueTable
              rows={data.rows}
              communityId={selectedCommunityId}
              communityName={selectedCommunity?.name ?? ""}
            />
          ) : (
            <EmptyState
              title="No prepared residents found for this community yet."
              description="This community does not have resident activation queue rows for the selected filter yet."
              actionHref={
                selectedCommunity
                  ? `/products/entry/communities/${selectedCommunity.id}`
                  : "/products/entry/communities"
              }
              actionLabel={
                selectedCommunity
                  ? "Back to community details"
                  : "Back to communities"
              }
            />
          )}
        </>
      )}
    </div>
  );
}
