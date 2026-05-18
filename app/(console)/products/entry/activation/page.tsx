import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
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
  const selectedCommunity = data.communities.find(
    (community) => community.id === selectedCommunityId,
  );
  const preparedCount = data.rows.length;
  const pendingPinCount = data.rows.filter((row) => row.status === "pending").length;
  const invitedCount = data.rows.filter((row) => row.status === "invited").length;
  const errorCount = data.rows.filter((row) => row.status === "failed").length;
  const progressPercent = data.progress
    ? Math.round(
        (data.progress.completedTasks / Math.max(data.progress.totalTasks, 1)) * 100,
      )
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activation Queue"
        description="Prepared resident records waiting for controlled activation."
        actions={
          <Link href="/products/entry/communities/new">
            <Button>Create community</Button>
          </Link>
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
          {data.progress ? (
            <section className="rounded-[26px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(16,20,29,0.94),rgba(12,17,25,0.9))] p-4 shadow-[0_16px_40px_rgba(2,6,23,0.16)] backdrop-blur">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-base font-semibold text-white">Setup overview</h2>
                    <span className="rounded-full bg-violet-500/12 px-2.5 py-1 text-[11px] font-semibold text-violet-200 ring-1 ring-inset ring-violet-400/20">
                      {data.progress.onboardingStatus === "complete_active"
                        ? "Complete & Active"
                        : "Pending setup"}
                    </span>
                  </div>
                  <p className="mt-3 text-xl font-semibold tracking-tight text-white">
                    {data.progress.completedTasks} / {data.progress.totalTasks} tasks
                    completed
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Next: {getOnboardingNextStepLabel(data.progress.nextStepKey)}
                  </p>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(109,99,255,1),rgba(129,140,248,0.9))]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-white">
                      {progressPercent}%
                    </span>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:w-[27rem] xl:grid-cols-4">
                  {[
                    { label: "Prepared", value: preparedCount },
                    { label: "Pending PIN", value: pendingPinCount },
                    { label: "Invited", value: invitedCount },
                    { label: "Errors", value: errorCount },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-[18px] border border-white/8 bg-[var(--surface-strong)] px-3 py-2.5"
                    >
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {metric.label}
                      </p>
                      <p className="mt-1.5 text-xl font-semibold text-white">
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
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
              actionHref="/products/entry/communities"
              actionLabel="Back to communities"
            />
          )}
        </>
      )}
    </div>
  );
}
