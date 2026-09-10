import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  MapPin,
  UsersRound,
} from "lucide-react";
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
import { getCommunityRegistrationAdminState } from "@/features/entry/communityRegistration/admin/queries";
import { isEntryPreviewReadOnly } from "@/features/entry/deploymentBoundary";
import { FieldCommunityStatusAction } from "@/features/entry/field/FieldCommunityStatusAction";
import { FieldDestinationsCard } from "@/features/entry/field/FieldDestinationsCard";
import { FieldRegistrationCard } from "@/features/entry/field/FieldRegistrationCard";

type FieldCommunityDetailPageProps = {
  params: Promise<{ communityId: string }>;
};

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
    items.push(
      `${community.activationPendingCount} prepared resident${community.activationPendingCount === 1 ? " is" : "s are"} waiting in the activation queue.`,
    );
  }

  if (previews.users.state === "unavailable") {
    items.push("Resident and staff counts are temporarily unavailable.");
  }

  return Array.from(new Set(items)).slice(0, 4);
}

const quickActionClass =
  "group flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-2 py-3 text-center text-xs font-semibold text-[var(--console-text)] transition-colors hover:border-[var(--console-accent-border)] hover:bg-[var(--console-surface-hover)]";

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

  if (!community) notFound();

  const isReadOnlyPreview = isEntryPreviewReadOnly();
  const attentionItems = getAttentionItems({
    community,
    onboardingDetail,
    previews,
  });
  const city = community.city.trim();
  const showCity = city && city.toLowerCase() !== "not set";

  return (
    <div className="space-y-5">
      <Link
        href="/field/entry/communities"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Communities
      </Link>

      <section className="space-y-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
              community.isActive
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-white/15 bg-white/5 text-[var(--console-text-soft)]"
            }`}
          >
            {community.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <h1 className="break-words text-3xl font-semibold leading-9 text-[var(--console-text)]">
          {community.name}
        </h1>
        <p className="text-sm font-medium text-[var(--console-text-muted)]">
          {community.totalUnits} units · {community.totalMembers} members
        </p>
        {showCity ? (
          <p className="text-sm text-[var(--console-text-soft)]">{city}</p>
        ) : null}
        <p className="text-xs text-[var(--console-text-soft)]">Community operations hub</p>
      </section>

      {attentionItems.length > 0 ? (
        <section className="rounded-lg border border-amber-300/25 bg-amber-300/[0.06] p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-200" />
            <h2 className="text-sm font-semibold text-amber-100">Attention</h2>
          </div>
          <ul className="mt-2 space-y-1.5 text-sm leading-5 text-amber-100/80">
            {attentionItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="community-quick-actions">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          Quick actions
        </p>
        <h2 id="community-quick-actions" className="sr-only">Community quick actions</h2>
        <div className="grid grid-cols-3 gap-2">
          <Link
            href={`/field/entry/communities/${encodeURIComponent(community.id)}/people`}
            className={quickActionClass}
          >
            <UsersRound aria-hidden="true" className="h-5 w-5 text-[var(--console-accent)]" />
            Residents & units
          </Link>
          <a href="#registration" className={quickActionClass}>
            <ClipboardList aria-hidden="true" className="h-5 w-5 text-[var(--console-accent)]" />
            Registration
          </a>
          <a href="#destinations" className={quickActionClass}>
            <MapPin aria-hidden="true" className="h-5 w-5 text-[var(--console-accent)]" />
            Destinations
          </a>
        </div>
      </section>

      <div id="registration" className="scroll-mt-24">
        <FieldRegistrationCard
          communityId={community.id}
          communityName={community.name}
          isReadOnlyPreview={isReadOnlyPreview}
          registrationState={registrationState}
        />
      </div>

      <div id="destinations" className="scroll-mt-24">
        <FieldDestinationsCard destinations={previews.destinations} />
      </div>

      <FieldCommunityStatusAction
        communityId={community.id}
        communityName={community.name}
        isActive={community.isActive}
        isReadOnlyPreview={isReadOnlyPreview}
      />
    </div>
  );
}
