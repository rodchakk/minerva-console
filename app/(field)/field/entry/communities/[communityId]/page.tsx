import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import {
  getCommunityDetailPreviews,
  type CommunityDetailPreviews,
} from "@/features/entry/communities/detailQueries";
import {
  getCommunityOnboardingDetail,
  getCommunityWithProgress,
  type CommunityOnboardingDetail,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";
import {
  formatFieldCount,
  getFieldCommunitySetupLabel,
  getFieldCommunityStatusLabel,
  getFieldStatusToneClass,
} from "@/features/entry/field/formatting";
import {
  getCommunityRegistrationAdminState,
} from "@/features/entry/communityRegistration/admin/queries";
import { isEntryPreviewReadOnly } from "@/features/entry/deploymentBoundary";
import { FieldRegistrationCard } from "@/features/entry/field/FieldRegistrationCard";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";

type FieldCommunityDetailPageProps = {
  params: Promise<{ communityId: string }>;
};

type MetricValue = {
  note?: string;
  value: string;
};

function getProgressPercent(completed: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((completed / total) * 100));
}

function getAggregateMetricValue(
  state: CommunityDetailPreviews["users"]["state"],
  value: number,
): MetricValue {
  if (state === "unavailable") {
    return {
      note: "Preview unavailable",
      value: "Unavailable",
    };
  }

  return {
    value: formatFieldCount(value),
  };
}

function getAttentionItems({
  community,
  onboardingDetail,
  previews,
}: {
  community: CommunityWithProgressItem;
  onboardingDetail: CommunityOnboardingDetail | null;
  previews: CommunityDetailPreviews;
}) {
  const items = [...(onboardingDetail?.blockers ?? [])];

  if (community.totalUnits <= 0 || community.nextStepKey === "units") {
    items.push("Unit records are still needed for this community.");
  }

  if (community.activationPendingCount > 0) {
    items.push("Prepared residents are waiting in the activation queue.");
  }

  if (previews.users.state === "unavailable") {
    items.push("Aggregate resident, guard, and admin counts are unavailable.");
  }

  if (!onboardingDetail) {
    items.push("Onboarding detail is unavailable.");
  }

  return Array.from(new Set(items)).slice(0, 4);
}

function SnapshotMetric({
  label,
  metric,
}: {
  label: string;
  metric: MetricValue;
}) {
  return (
    <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-soft)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[var(--console-text)]">
        {metric.value}
      </p>
      {metric.note ? (
        <p className="mt-2 text-xs leading-5 text-[var(--console-text-muted)]">
          {metric.note}
        </p>
      ) : null}
    </div>
  );
}

export default async function FieldCommunityDetailPage({
  params,
}: FieldCommunityDetailPageProps) {
  const { communityId } = await params;
  const [community, onboardingDetail, previews, registrationState] =
    await Promise.all([
      getCommunityWithProgress(communityId),
      getCommunityOnboardingDetail(communityId),
      getCommunityDetailPreviews(communityId, { allowMessages: false }),
      getCommunityRegistrationAdminState(communityId),
    ]);

  if (!community) {
    notFound();
  }

  const statusLabel = getFieldCommunityStatusLabel(community);
  const setupLabel = getFieldCommunitySetupLabel(community);
  const nextStepLabel = getOnboardingNextStepLabel(community.nextStepKey);
  const completedTasks =
    onboardingDetail?.completedTasks || community.completedTasks;
  const totalTasks = onboardingDetail?.totalTasks || community.totalTasks;
  const progressPercent = getProgressPercent(completedTasks, totalTasks);
  const userState = previews.users.state;
  const attentionItems = getAttentionItems({
    community,
    onboardingDetail,
    previews,
  });
  const snapshotMetrics = [
    {
      label: "Units",
      metric: { value: formatFieldCount(community.totalUnits) },
    },
    {
      label: "Residents",
      metric: getAggregateMetricValue(userState, previews.users.counts.residents),
    },
    {
      label: "Guards",
      metric: getAggregateMetricValue(userState, previews.users.counts.guards),
    },
    {
      label: "Admins",
      metric: getAggregateMetricValue(userState, previews.users.counts.admins),
    },
  ];

  if (community.activationPendingCount > 0) {
    snapshotMetrics.push({
      label: "Pending activations",
      metric: { value: formatFieldCount(community.activationPendingCount) },
    });
  }

  return (
    <div className="space-y-5">
      <Link
        href="/field/entry"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        ENTRY communities
      </Link>

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              "rounded-full border px-2.5 py-1 text-xs font-bold",
              getFieldStatusToneClass(statusLabel),
            ].join(" ")}
          >
            {statusLabel}
          </span>
          <span className="rounded-full border border-[var(--console-border)] bg-white/[0.03] px-2.5 py-1 text-xs font-bold text-[var(--console-text-muted)]">
            {setupLabel}
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-semibold leading-9 text-[var(--console-text)]">
          {community.name}
        </h1>
        <p className="mt-2 text-base text-[var(--console-text-muted)]">
          {community.city}
        </p>
      </section>

      <section aria-labelledby="field-community-snapshot" className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
            Snapshot
          </p>
          <h2
            id="field-community-snapshot"
            className="mt-1 text-xl font-semibold text-[var(--console-text)]"
          >
            Current aggregate state
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {snapshotMetrics.map((item) => (
            <SnapshotMetric
              key={item.label}
              label={item.label}
              metric={item.metric}
            />
          ))}
        </div>
      </section>

      <FieldRegistrationCard
        communityId={community.id}
        communityName={community.name}
        isReadOnlyPreview={isEntryPreviewReadOnly()}
        registrationState={registrationState}
      />

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          Setup
        </p>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-[var(--console-text)]">
              {setupLabel}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
              Next step: {nextStepLabel}.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold text-[var(--console-text)]">
              {completedTasks}/{totalTasks || 0}
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
              tasks
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--console-accent)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle
            aria-hidden="true"
            className="h-4 w-4 text-[var(--console-accent)]"
          />
          <h2 className="text-lg font-semibold text-[var(--console-text)]">
            Attention
          </h2>
        </div>

        {attentionItems.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--console-text-muted)]">
            {attentionItems.map((item) => (
              <li key={item} className="rounded-lg bg-white/[0.03] px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[var(--console-text-muted)]">
            No blockers or attention items are currently visible in the
            aggregate setup data.
          </p>
        )}
      </section>
    </div>
  );
}
