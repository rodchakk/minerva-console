import Link from "next/link";
import { Rubik } from "next/font/google";
import { notFound } from "next/navigation";
import {
  Activity,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CommunityAdminActivityDrawer } from "@/features/entry/communities/CommunityAdminActivityDrawer";
import { CommunityDestinationsManager } from "@/features/entry/communities/CommunityDestinationsManager";
import { CommunityFacilitiesDrawer } from "@/features/entry/communities/CommunityFacilitiesDrawer";
import { CommunityOnboardingReadinessPanel } from "@/features/entry/communities/CommunityOnboardingReadinessPanel";
import { CommunityUnitsWorkspace } from "@/features/entry/communities/CommunityUnitsWorkspace";
import { CommunityRegistrationCard } from "@/features/entry/communityRegistration/admin/CommunityRegistrationCard";
import { getCommunityRegistrationAdminState } from "@/features/entry/communityRegistration/admin/queries";
import { getCommunityAdminActivityPreview } from "@/features/entry/communities/activityQueries";
import {
  getCommunityDetailPreviews,
  getCommunityUnitsPageData,
  type CommunityDetailPreviews,
} from "@/features/entry/communities/detailQueries";
import {
  getCommunityOnboardingDetail,
  getCommunityWithProgress,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";
import { getCustomerProfileForCommunity } from "@/features/entry/customers/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";
import { cn } from "@/lib/supabase/utils";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

function getProgressPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

function needsSetupAttention(community: CommunityWithProgressItem) {
  return (
    community.totalUnits <= 0 ||
    community.nextStepKey === "units" ||
    (!community.isActive && community.onboardingStatus === "complete_active")
  );
}

function getSetupLabel(community: CommunityWithProgressItem) {
  if (needsSetupAttention(community)) return "Needs attention";
  if (community.onboardingStatus === "complete_active") return "Complete";
  if (community.onboardingStatus === "ready_for_final_review") return "Ready for review";
  return "Pending setup";
}

function getSetupTone(community: CommunityWithProgressItem) {
  if (needsSetupAttention(community)) return "warning" as const;
  if (community.onboardingStatus === "complete_active") return "success" as const;
  if (community.onboardingStatus === "ready_for_final_review") return "success" as const;
  return "info" as const;
}

function getPrimaryAction(community: CommunityWithProgressItem) {
  if (community.nextStepKey === "units" || community.totalUnits <= 0) {
    return {
      href: `/products/entry/communities/${community.id}/units/new`,
      label: "Create units",
    };
  }

  if (
    community.activationPendingCount > 0 ||
    community.nextStepKey === "review_activation_queue" ||
    community.nextStepKey === "activation_queue"
  ) {
    return {
      href: `/products/entry/activation?community_id=${community.id}`,
      label: "Open activation queue",
    };
  }

  if (community.nextStepKey === "facilities") {
    return {
      href: `/products/entry/communities/${community.id}/facilities/new`,
      label: "Configure facilities",
    };
  }

  if (community.nextStepKey === "admins" || community.nextStepKey === "staff") {
    return {
      href: `/products/entry/communities/${community.id}/staff`,
      label: "Assign resident admin",
    };
  }

  if (community.nextStepKey === "residents") {
    return {
      href: `/products/entry/communities/${community.id}/users`,
      label: "Review users",
    };
  }

  if (community.nextStepKey === "final_review") {
    return {
      href: "#setup-progress",
      label: "Final review",
    };
  }

  if (community.onboardingStatus === "complete_active" && community.isActive) {
    return {
      href: `/products/entry/communities/${community.id}/units`,
      label: "Open operations",
    };
  }

  return {
    href: "#setup-progress",
    label: needsSetupAttention(community) ? "Review setup" : "Continue setup",
  };
}

function getAttentionItems(
  community: CommunityWithProgressItem,
  previews: CommunityDetailPreviews,
  blockers: string[],
) {
  const items: Array<{ description: string; title: string }> = blockers.map(
    (blocker) => ({
      description: "Resolve this item before completing onboarding.",
      title: blocker,
    }),
  );

  if (items.length === 0 && (community.totalUnits <= 0 || community.nextStepKey === "units")) {
    items.push({
      description: "Units are required to manage residents and control access.",
      title: "Create unit records",
    });
  }

  if (items.length === 0 && community.activationPendingCount > 0) {
    items.push({
      description: "Prepared residents are waiting in the activation queue.",
      title: "Review pending activations",
    });
  }

  if (items.length === 0 && community.allowReservations && previews.facilities.state !== "live") {
    items.push({
      description: "Reservable areas can be configured before using reservations.",
      title: "Configure facilities",
    });
  }

  if (previews.users.state === "unavailable") {
    items.push({
      description: "The user preview could not be loaded safely right now.",
      title: "User preview unavailable",
    });
  }

  if (items.length === 0) {
    items.push({
      description: "No immediate blockers were detected in the readiness gate.",
      title: "No critical attention items",
    });
  }

  return items.slice(0, 1);
}

function DimensionalActionLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const primary = variant === "primary";
  const className =
    "relative isolate inline-flex h-10 items-center justify-center rounded-[7px] px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2E2936]";

  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 -z-20 rounded-[7px]",
          primary
            ? "bg-[#120539] shadow-[0_2px_0_#120539]"
            : "bg-[#141119] shadow-[0_2px_0_#141119]",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 -translate-y-0.5 rounded-[7px] border",
          primary
            ? "border-[#120539] bg-[#7553FF]"
            : "border-[#141119] bg-[#2E2936]",
        )}
      />
      <span className="relative -translate-y-0.5 inline-flex items-center gap-2">
        {children}
      </span>
    </>
  );

  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function MetricItem({
  icon: Icon,
  label,
  value,
  note,
  className,
}: {
  icon: typeof Building2;
  label: string;
  value: React.ReactNode;
  note: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "grid min-h-[88px] grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 px-4 py-3",
        className,
      )}
    >
      <span className="grid size-9 place-items-center rounded-full border border-white/[0.14] bg-white/[0.02] text-[#D8D3E7]">
        <Icon className="size-4 stroke-[1.7]" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.12em] text-[#8F879D]">{label}</p>
        <p className="mt-1 text-xl font-bold leading-none text-white">{value}</p>
        <p className="mt-1 truncate text-[10px] text-[#A9A3B2]">{note}</p>
      </div>
    </article>
  );
}

export default async function CommunitySetupPage(
  props: PageProps<"/products/entry/communities/[communityId]">,
) {
  const { communityId } = await props.params;
  const community = await getCommunityWithProgress(communityId);

  if (!community) notFound();

  const [
    previews,
    unitsData,
    adminActivity,
    onboardingDetail,
    registrationState,
    customerProfile,
  ] = await Promise.all([
    getCommunityDetailPreviews(community.id, {
      allowMessages: community.allowMessages,
    }),
    getCommunityUnitsPageData({ communityId: community.id }),
    getCommunityAdminActivityPreview(community.id, 50),
    getCommunityOnboardingDetail(community.id),
    getCommunityRegistrationAdminState(community.id),
    getCustomerProfileForCommunity(community.id),
  ]);

  const primaryAction = getPrimaryAction(community);
  const progressPercent = getProgressPercent(
    community.completedTasks,
    community.totalTasks,
  );
  const nextStepLabel = getOnboardingNextStepLabel(community.nextStepKey);
  const attentionItem = getAttentionItems(
    community,
    previews,
    onboardingDetail?.blockers ?? [],
  )[0];
  const shouldShowSetupProgress =
    onboardingDetail?.onboardingStatus !== "complete_active" &&
    community.onboardingStatus !== "complete_active";

  return (
    <div
      className={cn(
        rubik.className,
        "relative -mx-4 -my-4 min-h-[calc(100vh-4rem)] space-y-4 bg-[#2E2936] px-4 py-5 text-[#E7E5EA] lg:-mx-6 lg:-my-5 lg:px-6 lg:py-5 2xl:-mx-7 2xl:px-7",
      )}
    >
      <section className="flex flex-col gap-5 pt-1 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
            MINERVA CONSOLE · ENTRY
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white lg:text-[2.05rem]">
            {community.name}
          </h1>
          <p className="mt-2 text-sm text-[#A9A3B2]">{community.city}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone={community.isActive ? "success" : "default"}>
              {community.isActive ? "Active" : "Inactive"}
            </Badge>
            <Badge tone={getSetupTone(community)}>{getSetupLabel(community)}</Badge>
            <Badge tone="info">{community.unitLabel}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <DimensionalActionLink href="/products/entry/communities" variant="secondary">
            Back to communities
          </DimensionalActionLink>
          <DimensionalActionLink href={primaryAction.href}>
            {primaryAction.label}
          </DimensionalActionLink>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <Link
          href={`/products/entry/communities/${community.id}/users`}
          className="inline-flex h-9 items-center rounded-[7px] border border-[#141119] bg-[#24202B] px-3 text-xs font-semibold text-white transition hover:bg-[#2A2630]"
        >
          Manage residents
        </Link>
        <Link
          href={`/products/entry/activation?community_id=${community.id}`}
          className="inline-flex h-9 items-center rounded-[7px] border border-[#141119] bg-[#24202B] px-3 text-xs font-semibold text-white transition hover:bg-[#2A2630]"
        >
          Activation queue
        </Link>
        <a
          href="#resident-registration"
          className="inline-flex h-9 items-center rounded-[7px] border border-[#141119] bg-[#24202B] px-3 text-xs font-semibold text-white transition hover:bg-[#2A2630]"
        >
          Registration
        </a>

        <details className="relative">
          <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-[7px] border border-[#141119] bg-[#24202B] px-3 text-xs font-semibold text-white transition hover:bg-[#2A2630] [&::-webkit-details-marker]:hidden">
            <MoreHorizontal className="size-4" aria-hidden />
            More
          </summary>
          <div className="absolute left-0 top-11 z-40 w-64 overflow-hidden rounded-lg border border-[#141119] bg-[#24202B] p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
            <Link
              href={
                customerProfile
                  ? `/products/entry/customers/${customerProfile.id}`
                  : `/products/entry/customers/new?community_id=${community.id}`
              }
              className="block rounded-md px-3 py-2 text-xs font-medium text-[#D3CEDA] hover:bg-white/[0.04] hover:text-white"
            >
              {customerProfile ? "Customer profile" : "Create customer profile"}
            </Link>
            <Link
              href={`/products/entry/communities/${community.id}/staff`}
              className="block rounded-md px-3 py-2 text-xs font-medium text-[#D3CEDA] hover:bg-white/[0.04] hover:text-white"
            >
              Community operators
            </Link>
            <Link
              href={`/products/entry/settings?community_id=${community.id}`}
              className="block rounded-md px-3 py-2 text-xs font-medium text-[#D3CEDA] hover:bg-white/[0.04] hover:text-white"
            >
              Community settings
            </Link>
            <Link
              href={`/products/entry/messages?community_id=${community.id}`}
              className="block rounded-md px-3 py-2 text-xs font-medium text-[#D3CEDA] hover:bg-white/[0.04] hover:text-white"
            >
              Send message
            </Link>
          </div>
        </details>
      </section>

      <section className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]">
        <div className="grid xl:grid-cols-[1.2fr_.9fr_1fr_1fr]">
          <div className="min-h-[112px] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
              Community readiness
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              {getSetupLabel(community)}
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#A9A3B2]">
              {attentionItem?.title === "No critical attention items"
                ? "No critical attention items detected. This community is ready to continue from its current checkpoint."
                : attentionItem?.description}
            </p>
          </div>

          <div className="min-h-[112px] border-t border-white/[0.07] px-5 py-4 xl:border-l xl:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
              Setup progress
            </p>
            <p className="mt-2 text-base font-semibold text-white">
              {community.completedTasks} / {community.totalTasks} tasks complete
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-white/[0.08]">
              <div
                className="h-1.5 rounded-full bg-[#7553FF]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#8F879D]">{progressPercent}% complete</p>
          </div>

          <div className="min-h-[112px] border-t border-white/[0.07] px-5 py-4 xl:border-l xl:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
              Next step
            </p>
            <p className="mt-2 text-base font-semibold text-white">{nextStepLabel}</p>
            <p className="mt-2 text-xs leading-5 text-[#A9A3B2]">
              Continue from the current setup checkpoint.
            </p>
          </div>

          <div className="min-h-[112px] border-t border-white/[0.07] px-5 py-4 xl:border-l xl:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
              What needs attention
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {attentionItem?.title ?? "No critical attention items"}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#A9A3B2]">
              {attentionItem?.description}
            </p>
          </div>
        </div>
      </section>

      <section className="relative grid overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF] sm:grid-cols-2 xl:grid-cols-5">
        <MetricItem
          icon={Building2}
          label="Units"
          value={community.totalUnits}
          note="Total units"
          className="border-b border-[#141119] sm:border-r xl:border-b-0"
        />
        <MetricItem
          icon={Users}
          label="Members"
          value={community.totalMembers}
          note="Total residents"
          className="border-b border-[#141119] xl:border-r xl:border-b-0"
        />
        <MetricItem
          icon={Clock3}
          label="Pending activations"
          value={community.activationPendingCount}
          note="Waiting in queue"
          className="border-b border-[#141119] sm:border-r xl:border-b-0"
        />
        <MetricItem
          icon={CalendarDays}
          label="Facilities"
          value={previews.facilities.state === "live" ? previews.facilities.activeCount : "—"}
          note={
            previews.facilities.state === "disabled"
              ? "Reservations disabled"
              : previews.facilities.state === "live"
                ? "Active facilities"
                : "Not configured"
          }
          className="border-b border-[#141119] xl:border-r xl:border-b-0"
        />
        <MetricItem
          icon={Activity}
          label="Admin activity"
          value={adminActivity.state === "live" ? adminActivity.total : "—"}
          note="Recent administrative events"
        />
      </section>

      <nav className="sticky top-0 z-20 flex gap-5 border-b border-white/[0.07] bg-[rgba(46,41,54,0.96)] px-1 backdrop-blur">
        {[
          ["Overview", "#community-overview"],
          ["Units", "#units"],
          ["Registration", "#resident-registration"],
          ["Destinations", "#manual-destinations"],
          ["Setup", "#setup-progress"],
        ].map(([label, href], index) => (
          <a
            key={label}
            href={href}
            className={cn(
              "relative py-2.5 text-xs font-semibold",
              index === 0
                ? "text-white after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[#7553FF]"
                : "text-[#8F879D] hover:text-white",
            )}
          >
            {label}
          </a>
        ))}
      </nav>

      <div id="community-overview" className="space-y-4">
        <CommunityUnitsWorkspace
          communityId={community.id}
          units={unitsData.items}
        />

        <CommunityRegistrationCard
          campaign={registrationState.campaign}
          communityId={community.id}
          communityName={community.name}
          hasOperationalCampaign={registrationState.hasOperationalCampaign}
          registrationProgress={registrationState.registrationProgress}
          submittedUnitCount={registrationState.submittedUnitCount}
          totalCampaignUnitCount={registrationState.totalCampaignUnitCount}
          totalUnits={community.totalUnits}
          units={registrationState.units}
        />

        <div id="manual-destinations">
          <CommunityDestinationsManager
            communityId={community.id}
            destinations={previews.destinations.items}
            state={previews.destinations.state}
          />
        </div>

        <section className="relative grid gap-3 overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] p-4 before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF] md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-white">Facilities</p>
            <p className="mt-1 text-xs leading-5 text-[#A9A3B2]">
              {previews.facilities.state === "live"
                ? `${previews.facilities.activeCount} active facilities configured.`
                : "Review reservation availability and facility configuration."}
            </p>
            <div className="mt-3">
              <CommunityFacilitiesDrawer
                communityId={community.id}
                facilities={previews.facilities.items}
                state={previews.facilities.state}
                triggerLabel="Manage facilities"
              />
            </div>
          </div>

          <div className="border-t border-white/[0.07] pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0">
            <p className="text-sm font-semibold text-white">Admin activity</p>
            <p className="mt-1 text-xs leading-5 text-[#A9A3B2]">
              Review important administrative actions recorded for this community.
            </p>
            <div className="mt-3">
              <CommunityAdminActivityDrawer
                activities={adminActivity.items}
                triggerLabel="View activity"
              />
            </div>
          </div>
        </section>

        {shouldShowSetupProgress ? (
          <div id="setup-progress">
            <CommunityOnboardingReadinessPanel
              communityId={community.id}
              detail={onboardingDetail}
              nextStepKey={community.nextStepKey}
              progressLabel={`${community.completedTasks} / ${community.totalTasks} tasks completed.`}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
