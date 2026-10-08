import Link from "next/link";
import { Rubik } from "next/font/google";
import { notFound } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CommunityAdminActivityDrawer } from "@/features/entry/communities/CommunityAdminActivityDrawer";
import { CommunityDestinationsManager } from "@/features/entry/communities/CommunityDestinationsManager";
import { CommunityDetailWorkspace } from "@/features/entry/communities/CommunityDetailWorkspace";
import { CommunityFacilitiesDrawer } from "@/features/entry/communities/CommunityFacilitiesDrawer";
import { CommunityOnboardingReadinessPanel } from "@/features/entry/communities/CommunityOnboardingReadinessPanel";
import { CommunityRegistrationCard } from "@/features/entry/communityRegistration/admin/CommunityRegistrationCard";
import { getCommunityRegistrationAdminState } from "@/features/entry/communityRegistration/admin/queries";
import { getCommunityAdminActivityPreview } from "@/features/entry/communities/activityQueries";
import {
  getCommunityDetailPreviews,
  type CommunityDetailPreviews,
} from "@/features/entry/communities/detailQueries";
import {
  getCommunityOnboardingDetail,
  getCommunityWithProgress,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";
import { getCustomerProfileForCommunity } from "@/features/entry/customers/queries";
import { getCommunityUsersPage } from "@/features/entry/users/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";
import { cn } from "@/lib/supabase/utils";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type WorkspaceTab = "overview" | "setup" | "activity";

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

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
  if (community.onboardingStatus === "ready_for_final_review") {
    return "Ready for review";
  }
  return "Pending setup";
}

function getSetupTone(community: CommunityWithProgressItem) {
  if (needsSetupAttention(community)) return "warning" as const;
  if (community.onboardingStatus === "complete_active") return "success" as const;
  if (community.onboardingStatus === "ready_for_final_review") {
    return "success" as const;
  }
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
      label: "Manage users & access",
    };
  }

  if (community.nextStepKey === "final_review") {
    return {
      href: `/products/entry/communities/${community.id}?tab=setup#community-workspace`,
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
    href: `/products/entry/communities/${community.id}?tab=setup#community-workspace`,
    label: needsSetupAttention(community) ? "Review setup" : "Continue setup",
  };
}

function getAttentionItem(
  community: CommunityWithProgressItem,
  previews: CommunityDetailPreviews,
  blockers: string[],
) {
  if (blockers.length > 0) {
    return {
      description: "Resolve this item before completing onboarding.",
      title: blockers[0] ?? "Setup blocker",
    };
  }

  if (community.totalUnits <= 0 || community.nextStepKey === "units") {
    return {
      description: "Units are required to manage residents and control access.",
      title: "Create unit records",
    };
  }

  if (community.activationPendingCount > 0) {
    return {
      description: "Prepared residents are waiting in the activation queue.",
      title: "Review pending activations",
    };
  }

  if (community.allowReservations && previews.facilities.state !== "live") {
    return {
      description: "Reservable areas can be configured before using reservations.",
      title: "Configure facilities",
    };
  }

  return {
    description: "No immediate blockers were detected in the readiness gate.",
    title: "No critical attention items",
  };
}

function formatRegistrationStatus(
  status: string | undefined,
  hasOperationalCampaign: boolean,
) {
  if (!status) return "Not started";
  if (!hasOperationalCampaign) return "Previous campaign";

  switch (status.trim().toLowerCase()) {
    case "open":
      return "Campaign open";
    case "paused":
      return "Campaign paused";
    case "review":
      return "In review";
    case "confirmed":
      return "Confirmed";
    default:
      return status;
  }
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

  return (
    <Link
      href={href}
      className="relative isolate inline-flex h-10 items-center justify-center rounded-[7px] px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2E2936]"
    >
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
      <span className="relative -translate-y-0.5">{children}</span>
    </Link>
  );
}

export default async function CommunitySetupPage(
  props: PageProps<"/products/entry/communities/[communityId]">,
) {
  const [{ communityId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const community = await getCommunityWithProgress(communityId);

  if (!community) notFound();

  const [
    previews,
    adminActivity,
    onboardingDetail,
    registrationState,
    customerProfile,
    usersPage,
  ] = await Promise.all([
      getCommunityDetailPreviews(community.id, {
        allowMessages: community.allowMessages,
      }),
      getCommunityAdminActivityPreview(community.id, 40),
      getCommunityOnboardingDetail(community.id),
      getCommunityRegistrationAdminState(community.id),
      getCustomerProfileForCommunity(community.id),
      getCommunityUsersPage(community.id),
    ]);

  const requestedTab = getSingleParam(searchParams.tab);
  const initialTab: WorkspaceTab =
    requestedTab === "setup" || requestedTab === "activity"
      ? requestedTab
      : "overview";

  const primaryAction = getPrimaryAction(community);
  const progressPercent = getProgressPercent(
    community.completedTasks,
    community.totalTasks,
  );
  const nextStepLabel = getOnboardingNextStepLabel(community.nextStepKey);
  const attentionItem = getAttentionItem(
    community,
    previews,
    onboardingDetail?.blockers ?? [],
  );
  const activeDestinationCount = previews.destinations.items.filter(
    (destination) => destination.isActive,
  ).length;
  const facilitiesLabel =
    previews.facilities.state === "disabled"
      ? "Reservations disabled"
      : previews.facilities.state === "live"
        ? previews.facilities.activeCount +
          " active " +
          (previews.facilities.activeCount === 1 ? "facility" : "facilities")
        : previews.facilities.state === "unavailable"
          ? "Facilities unavailable"
          : "Not configured";
  const registrationStatus = formatRegistrationStatus(
    registrationState.campaign?.status,
    registrationState.hasOperationalCampaign,
  );
  const userAccountCount = usersPage.users.length;
  const activeUserAccountCount = usersPage.users.filter(
    (user) => user.isActive,
  ).length;
  const inactiveUserAccountCount = userAccountCount - activeUserAccountCount;

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

        <div className="flex flex-wrap items-start gap-2.5">
          <DimensionalActionLink
            href="/products/entry/communities"
            variant="secondary"
          >
            Back to communities
          </DimensionalActionLink>

          <details className="relative">
            <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-[7px] border border-[#141119] bg-[#2E2936] text-white shadow-[0_2px_0_#141119] [&::-webkit-details-marker]:hidden">
              <MoreHorizontal className="size-4" aria-hidden />
              <span className="sr-only">More community actions</span>
            </summary>
            <div className="absolute right-0 top-12 z-40 w-60 overflow-hidden rounded-lg border border-[#141119] bg-[#24202B] p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
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

          <DimensionalActionLink href={primaryAction.href}>
            {primaryAction.label}
          </DimensionalActionLink>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]">
        <div className="grid xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(145px,.66fr))]">
          <div className="min-h-[122px] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
              Community status
            </p>
            <div className="mt-2 flex items-center gap-2.5">
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  attentionItem.title === "No critical attention items"
                    ? "bg-[#67D7A5] shadow-[0_0_0_4px_rgba(103,215,165,0.08)]"
                    : "bg-[#F6C941] shadow-[0_0_0_4px_rgba(246,201,65,0.08)]",
                )}
              />
              <h2 className="text-lg font-semibold text-white">
                {getSetupLabel(community)}
              </h2>
            </div>
            <p className="mt-2 max-w-xl text-xs leading-5 text-[#A9A3B2]">
              {attentionItem.title === "No critical attention items"
                ? "Nothing critical is blocking this community. Continue from the current readiness checkpoint."
                : attentionItem.description}
            </p>
          </div>

          <Link
            href={`/products/entry/communities/${community.id}?tab=setup#community-workspace`}
            className="min-h-[122px] border-t border-white/[0.07] px-5 py-4 transition hover:bg-white/[0.015] xl:border-l xl:border-t-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
              Setup
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {community.completedTasks} / {community.totalTasks}
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-white/[0.08]">
              <div
                className="h-1.5 rounded-full bg-[#7553FF]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#8F879D]">{progressPercent}% complete</p>
          </Link>

          <Link
            href={`/products/entry/communities/${community.id}/units`}
            className="min-h-[122px] border-t border-white/[0.07] px-5 py-4 transition hover:bg-white/[0.015] xl:border-l xl:border-t-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
              Directory
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {community.totalUnits} units
            </p>
            <p className="mt-2 text-xs text-[#A9A3B2]">
              {community.totalMembers} residents linked
            </p>
          </Link>

          <Link
            href={`/products/entry/communities/${community.id}/users`}
            className="min-h-[122px] border-t border-white/[0.07] px-5 py-4 transition hover:bg-white/[0.015] xl:border-l xl:border-t-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
              Users & access
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {userAccountCount} accounts
            </p>
            <p className="mt-2 text-xs text-[#A9A3B2]">
              {activeUserAccountCount} active · {inactiveUserAccountCount} inactive
            </p>
          </Link>

          <Link
            href={`/products/entry/activation?community_id=${community.id}`}
            className="min-h-[122px] border-t border-white/[0.07] px-5 py-4 transition hover:bg-white/[0.015] xl:border-l xl:border-t-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
              Pending activation
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {community.activationPendingCount}
            </p>
            <p className="mt-2 text-xs text-[#A9A3B2]">
              {community.activationPendingCount === 0
                ? "No residents waiting"
                : "Residents waiting in queue"}
            </p>
          </Link>
        </div>
      </section>

      <div id="community-workspace">
        <CommunityDetailWorkspace
          activityControl={
            <CommunityAdminActivityDrawer
              activities={adminActivity.items}
              triggerLabel="View all activity"
            />
          }
          activityItems={adminActivity.items}
          adminActivityCount={
            adminActivity.state === "unavailable" ? null : adminActivity.total
          }
          communityId={community.id}
          destinationActiveCount={activeDestinationCount}
          destinationsManager={
            <CommunityDestinationsManager
              communityId={community.id}
              destinations={previews.destinations.items}
              state={previews.destinations.state}
            />
          }
          facilityControl={
            <CommunityFacilitiesDrawer
              communityId={community.id}
              facilities={previews.facilities.items}
              state={previews.facilities.state}
              triggerLabel="Manage facilities"
            />
          }
          facilitiesLabel={facilitiesLabel}
          initialTab={initialTab}
          memberCount={community.totalMembers}
          userAccountCount={userAccountCount}
          activeUserAccountCount={activeUserAccountCount}
          nextActionDescription={
            attentionItem.title === "No critical attention items"
              ? "No critical blockers were detected. Continue with " +
                nextStepLabel.toLowerCase() +
                "."
              : attentionItem.description
          }
          nextActionHref={primaryAction.href}
          nextActionLabel={primaryAction.label}
          pendingActivationCount={community.activationPendingCount}
          registrationManager={
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
          }
          registrationStatus={registrationStatus}
          registrationSubmittedResidents={
            registrationState.registrationProgress.submittedResidents
          }
          registrationSubmittedUnits={registrationState.submittedUnitCount}
          setupPanel={
            <CommunityOnboardingReadinessPanel
              communityId={community.id}
              detail={onboardingDetail}
              nextStepKey={community.nextStepKey}
              progressLabel={`${community.completedTasks} / ${community.totalTasks} tasks completed.`}
            />
          }
          unitCount={community.totalUnits}
        />
      </div>
    </div>
  );
}
