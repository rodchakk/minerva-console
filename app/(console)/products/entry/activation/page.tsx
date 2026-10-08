import Link from "next/link";
import { Building2 } from "lucide-react";
import { Rubik } from "next/font/google";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActivationQueueReviewAcknowledge } from "@/features/entry/activation/ActivationQueueReviewAcknowledge";
import { ActivationQueueTable } from "@/features/entry/activation/ActivationQueueTable";
import { getActivationQueuePageData } from "@/features/entry/activation/actions";
import { LaunchCampaignButton } from "@/features/entry/onboardingCampaigns/LaunchCampaignButton";
import { getCampaignPreview } from "@/features/entry/onboardingCampaigns/actions";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";
import { cn } from "@/lib/supabase/utils";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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
    <div
      className={cn(
        rubik.className,
        "relative left-1/2 w-[calc(100vw-2rem)] max-w-[2200px] -translate-x-1/2 space-y-3 bg-[#2E2936] text-[#E7E5EA] lg:w-[calc(100vw-19rem)] 2xl:w-[calc(100vw-19.5rem)]",
      )}
    >
      <header className="flex flex-col gap-4 pt-1 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
            MINERVA CONSOLE · ENTRY
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
            Activation Queue
          </h1>
          <p className="mt-2 text-sm text-[#A9A3B2]">
            Prepare, invite, and activate resident accounts from one operational queue.
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-2.5">
          {selectedCommunity ? (
            <Link
              href={`/products/entry/communities/${selectedCommunity.id}`}
              className="relative isolate inline-flex h-10 items-center justify-center gap-2 rounded-[7px] px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF]"
            >
              <span
                aria-hidden
                className="absolute inset-0 -z-20 rounded-[7px] bg-[#141119] shadow-[0_2px_0_#141119]"
              />
              <span
                aria-hidden
                className="absolute inset-0 -z-10 -translate-y-0.5 rounded-[7px] border border-[#141119] bg-[#2E2936]"
              />
              <span className="relative -translate-y-0.5 inline-flex items-center gap-2 whitespace-nowrap">
                <Building2 className="size-4" aria-hidden />
                Back to community
              </span>
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
      </header>

      {!selectedCommunityId ? (
        <div className="space-y-5">
          <EmptyState
            title="Select a community"
            description="Choose a community to review prepared residents, queue status, and onboarding progress."
            actionHref="/products/entry/communities"
            actionLabel="Back to communities"
          />

          {data.communities.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.communities.map((community) => (
                <Link
                  key={community.id}
                  href={`/products/entry/activation?community_id=${community.id}`}
                  className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] p-4 transition before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF] hover:bg-[#292431]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-white">
                        {community.name}
                      </h2>
                      <p className="mt-1 text-xs text-[#A9A3B2]">
                        {community.city}
                      </p>
                    </div>
                    <span className="inline-flex min-h-6 items-center rounded-[4px] border border-[rgba(117,83,255,0.22)] bg-[rgba(117,83,255,0.08)] px-2 py-1 text-[10px] font-semibold text-[#D8D1FF]">
                      {community.activationPendingCount} pending
                    </span>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-[#A9A3B2]">
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
