import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ActivationQueueFilters } from "@/features/entry/activation/ActivationQueueFilters";
import { ActivationQueueTable } from "@/features/entry/activation/ActivationQueueTable";
import { getActivationQueuePageData } from "@/features/entry/activation/actions";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ActivationQueuePage(
  props: PageProps<"/products/entry/activation">,
) {
  const searchParams = await props.searchParams;
  const selectedCommunityId = getSingleParam(searchParams.community_id);
  const selectedStatus = getSingleParam(searchParams.status);
  const data = await getActivationQueuePageData({
    communityId: selectedCommunityId,
    status: selectedStatus,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Activation Queue"
        description="Review prepared resident records and onboarding progress before controlled activation goes live."
        actions={
          <Link href="/products/entry/communities/new">
            <Button>Create community</Button>
          </Link>
        }
      />

      <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="text-sm font-semibold text-amber-900">
          Prepared residents stay in a pre-activation state here. Generate PIN
          creates temporary 7-day credentials for selected residents. It does not
          create active ENTRY users, send emails, or create profiles.
        </p>
      </div>

      <ActivationQueueFilters
        communities={data.communities}
        selectedCommunityId={selectedCommunityId}
        selectedStatus={selectedStatus}
      />

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
                  className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">
                        {community.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">{community.city}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {community.activationPendingCount} pending
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Next step: {getOnboardingNextStepLabel(community.nextStepKey)}
                  </p>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {data.progress ? (
            <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Onboarding progress
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {data.progress.completedTasks} / {data.progress.totalTasks} tasks
                    completed. Next step:{" "}
                    {getOnboardingNextStepLabel(data.progress.nextStepKey)}.
                  </p>
                </div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-800">
                  {data.progress.onboardingStatus === "complete_active"
                    ? "Complete & Active"
                    : "Pending setup"}
                </span>
              </div>
            </section>
          ) : null}

          {data.rows.length > 0 ? (
            <ActivationQueueTable
              rows={data.rows}
              communityId={selectedCommunityId}
              communityName={
                data.communities.find((c) => c.id === selectedCommunityId)
                  ?.name ?? ""
              }
            />
          ) : (
            <EmptyState
              title="No prepared residents found for this community yet."
              description="This community does not have resident activation queue rows for the selected filter yet."
              actionHref="/products/entry/communities"
              actionLabel="Back to communities"
            />
          )}
        </>
      )}
    </div>
  );
}
