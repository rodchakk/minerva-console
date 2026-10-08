"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Filter,
  MapPin,
  Search,
  Tag,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import {
  getCommunityLifecycleLabel,
  getCommunityLifecycleState,
  getCommunityProgressValue,
  getCommunitySetupLabel,
} from "@/features/entry/communities/lifecycle";
import { setCommunityActiveStatusAction } from "@/features/entry/communities/statusActions";
import type { CommunityListItem } from "@/features/entry/communities/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";
import { cn } from "@/lib/supabase/utils";

export type CommunityDirectoryFilter =
  | "all"
  | "active"
  | "pending_setup"
  | "needs_attention"
  | "inactive";

type CommunityListProps = {
  communities: CommunityListItem[];
  initialFilter?: CommunityDirectoryFilter;
};

type PendingCommunityAction = {
  community: CommunityListItem;
  nextIsActive: boolean;
};

type DrawerTab = "overview" | "setup" | "users";
type SortMode = "name_asc" | "name_desc" | "members_desc" | "progress_desc";

const setupStageLabels = [
  "Community created",
  "Basic information",
  "Units and spaces",
  "Members import",
  "Access configuration",
  "Testing and validation",
  "Final readiness check",
];

function getCommunityHref(communityId: string) {
  return "/products/entry/communities/" + communityId;
}

function getUsersHref(communityId: string) {
  return "/products/entry/communities/" + communityId + "/users";
}

function getActivationQueueHref(communityId: string) {
  return (
    "/products/entry/activation?community_id=" + encodeURIComponent(communityId)
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "MC"
  );
}

function formatUnitLabel(label: string) {
  return label.trim().toLowerCase() === "condominios" ? "Condos" : label;
}

function getProgressWidth(completed: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return Math.min(100, Math.round((completed / total) * 100)) + "%";
}

function getSetupState(community: CommunityListItem) {
  const lifecycleState = getCommunityLifecycleState(community);

  if (lifecycleState === "needs_attention") {
    return {
      label: "Needs attention",
      progressTone: "bg-[#F6C941]",
      tone: "warning" as const,
    };
  }

  if (community.onboardingStatus === "complete_active") {
    return {
      label: "Complete",
      progressTone: "bg-[#67D7A5]",
      tone: "success" as const,
    };
  }

  return {
    label: getCommunitySetupLabel(community),
    progressTone: "bg-[#7553FF]",
    tone: "violet" as const,
  };
}

function getLifecycleChipClass(
  lifecycleState: ReturnType<typeof getCommunityLifecycleState>,
) {
  switch (lifecycleState) {
    case "fully_active":
      return "border-[rgba(103,215,165,0.22)] bg-[rgba(103,215,165,0.06)] text-[#8EE2B9]";
    case "needs_attention":
      return "border-[rgba(255,102,126,0.25)] bg-[rgba(255,102,126,0.06)] text-[#FFB6C1]";
    case "inactive":
      return "border-white/10 bg-white/[0.025] text-[#C9C4CF]";
    case "pending_setup":
    default:
      return "border-[rgba(228,194,106,0.24)] bg-[rgba(228,194,106,0.06)] text-[#F0D995]";
  }
}

function getSetupChipClass(tone: ReturnType<typeof getSetupState>["tone"]) {
  switch (tone) {
    case "success":
      return "border-[rgba(103,215,165,0.18)] bg-[rgba(103,215,165,0.05)] text-[#8EE2B9]";
    case "warning":
      return "border-[rgba(228,194,106,0.20)] bg-[rgba(228,194,106,0.05)] text-[#F0D995]";
    case "violet":
    default:
      return "border-[rgba(117,83,255,0.24)] bg-[rgba(117,83,255,0.07)] text-[#D8D1FF]";
  }
}

function StatusChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-[4px] border px-2 py-1 text-[11px] font-semibold leading-4",
        className,
      )}
    >
      {children}
    </span>
  );
}

function FeatureChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[4px] border border-[rgba(117,83,255,0.18)] bg-[rgba(117,83,255,0.06)] px-2 py-0.5 text-[10px] font-medium leading-4 text-[#CFC7FF]">
      {children}
    </span>
  );
}

function DimensionalLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const primary = variant === "primary";

  return (
    <Link
      href={href}
      className={cn(
        "relative isolate inline-flex h-9 items-center justify-center rounded-[7px] px-3.5 text-xs font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2E2936]",
        className,
      )}
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
      <span className="relative -translate-y-0.5 inline-flex items-center gap-2">
        {children}
      </span>
    </Link>
  );
}

function matchesLifecycleFilter(
  community: CommunityListItem,
  filter: CommunityDirectoryFilter,
) {
  const state = getCommunityLifecycleState(community);

  switch (filter) {
    case "active":
      return state === "fully_active";
    case "pending_setup":
      return state === "pending_setup";
    case "needs_attention":
      return state === "needs_attention";
    case "inactive":
      return state === "inactive";
    case "all":
    default:
      return true;
  }
}

function getAttentionState(community: CommunityListItem) {
  const state = getCommunityLifecycleState(community);

  switch (state) {
    case "fully_active":
      return {
        dot: "bg-[#67D7A5]",
        label: "Active",
        note: "Fully operational",
      };
    case "needs_attention":
      return {
        dot: "bg-[#FF667E]",
        label: "Needs attention",
        note: "Setup requires review",
      };
    case "inactive":
      return {
        dot: "bg-[#8F879D]",
        label: "Inactive",
        note: "Archived from main view",
      };
    case "pending_setup":
    default:
      return {
        dot: "bg-[#F6C941]",
        label: "Active setup",
        note: "Awaiting completion",
      };
  }
}

function buildSetupStages(community: CommunityListItem) {
  const totalTasks = Math.max(community.totalTasks, 1);

  return Array.from({ length: totalTasks }, (_, index) => ({
    done: index < community.completedTasks,
    label: setupStageLabels[index] ?? "Setup task " + (index + 1),
  }));
}

export function CommunityList({
  communities,
  initialFilter = "all",
}: CommunityListProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [lifecycleFilter, setLifecycleFilter] =
    useState<CommunityDirectoryFilter>(initialFilter);
  const [sortMode, setSortMode] = useState<SortMode>("name_asc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    communities[0]?.id ?? null,
  );
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("overview");
  const [pendingAction, setPendingAction] =
    useState<PendingCommunityAction | null>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleCommunities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = communities.filter((community) => {
      const featureText = [
        community.allowFrequentAccess ? "frequent access" : "",
        community.allowReservations ? "reservations" : "",
        community.allowMessages ? "messages" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const matchesQuery =
        !normalizedQuery ||
        [
          community.name,
          community.city,
          community.unitLabel,
          featureText,
          String(community.totalUnits),
          String(community.totalMembers),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesQuery && matchesLifecycleFilter(community, lifecycleFilter);
    });

    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "members_desc":
          return b.totalMembers - a.totalMembers || a.name.localeCompare(b.name);
        case "progress_desc":
          return (
            getCommunityProgressValue(b) - getCommunityProgressValue(a) ||
            a.name.localeCompare(b.name)
          );
        case "name_asc":
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [communities, lifecycleFilter, query, sortMode]);

  const activeCommunity =
    visibleCommunities.find((community) => community.id === selectedId) ??
    visibleCommunities[0] ??
    null;

  const expectedConfirmation = pendingAction?.nextIsActive
    ? "REACTIVAR"
    : "DESACTIVAR";
  const canSubmit =
    confirmationText.trim().toUpperCase() === expectedConfirmation;

  function selectCommunity(communityId: string) {
    setSelectedId(communityId);
    setDrawerTab("overview");
  }

  function openStatusModal(
    community: CommunityListItem,
    nextIsActive: boolean,
  ) {
    setErrorMessage(null);
    setConfirmationText("");
    setPendingAction({ community, nextIsActive });
  }

  function closeStatusModal() {
    if (isPending) {
      return;
    }

    setPendingAction(null);
    setConfirmationText("");
    setErrorMessage(null);
  }

  function submitStatusChange() {
    if (!pendingAction || !canSubmit) {
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      const result = await setCommunityActiveStatusAction(
        pendingAction.community.id,
        pendingAction.nextIsActive,
      );

      if (!result.success) {
        setErrorMessage(
          result.error ?? "Could not update the community status.",
        );
        return;
      }

      setPendingAction(null);
      setConfirmationText("");
      router.refresh();
    });
  }

  return (
    <>
      <section className="relative rounded-[10px] border border-[#141119] bg-[#24202B] p-3 before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#A9A3B2]"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search communities by name, city, or label..."
              className="h-9 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] pl-10 pr-3 text-sm text-[#E7E5EA] shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
            />
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((value) => !value)}
              className="inline-flex h-9 min-w-[105px] items-center justify-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF]"
            >
              <Filter className="size-4" aria-hidden />
              Filters
              {lifecycleFilter !== "all" ? (
                <span className="size-1.5 rounded-full bg-[#7553FF]" />
              ) : null}
            </button>

            {filterOpen ? (
              <div className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-lg border border-[#141119] bg-[#24202B] shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
                <div className="flex items-center justify-between border-b border-[#141119] px-4 py-3">
                  <p className="text-sm font-semibold text-white">
                    Filter communities
                  </p>
                  <button
                    type="button"
                    onClick={() => setFilterOpen(false)}
                    className="text-[#8F879D] hover:text-white"
                    aria-label="Close filters"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>

                <div className="p-3.5">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                    Lifecycle
                  </p>
                  <div className="space-y-1">
                    {[
                      ["all", "All communities"],
                      ["active", "Fully active"],
                      ["pending_setup", "Pending setup"],
                      ["needs_attention", "Needs attention"],
                      ["inactive", "Inactive / archived"],
                    ].map(([value, label]) => {
                      const checked = lifecycleFilter === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setLifecycleFilter(
                              value as CommunityDirectoryFilter,
                            )
                          }
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                            checked
                              ? "bg-[rgba(117,83,255,0.10)] text-white"
                              : "text-[#D3CEDA] hover:bg-white/[0.03] hover:text-white",
                          )}
                        >
                          <span>{label}</span>
                          <span
                            className={cn(
                              "size-3.5 rounded-[3px] border",
                              checked
                                ? "border-[#7553FF] bg-[#7553FF]"
                                : "border-white/20 bg-transparent",
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#141119] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setLifecycleFilter("all")}
                    className="text-xs font-medium text-[#A9A3B2] hover:text-white"
                  >
                    Clear filter
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterOpen(false)}
                    className="rounded-md border border-[#120539] bg-[#7553FF] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_2px_0_#120539]"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs text-[#8F879D]">
            <span>
              {visibleCommunities.length}{" "}
              {visibleCommunities.length === 1 ? "community" : "communities"}
            </span>
            <label className="relative">
              <select
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value as SortMode)
                }
                className="h-9 appearance-none rounded-[7px] border border-[#141119] bg-[#2E2936] pl-3 pr-8 text-xs font-medium text-[#E7E5EA] outline-none focus:ring-2 focus:ring-[#7553FF]"
              >
                <option value="name_asc">Name (A–Z)</option>
                <option value="name_desc">Name (Z–A)</option>
                <option value="members_desc">Most residents</option>
                <option value="progress_desc">Setup progress</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#8F879D]"
                aria-hidden
              />
            </label>
          </div>
        </div>
      </section>

      {visibleCommunities.length > 0 ? (
        <section
          className={cn(
            "grid items-start gap-3",
            activeCommunity
              ? "xl:h-[690px] xl:grid-cols-[minmax(0,1fr)_430px]"
              : "grid-cols-1",
          )}
        >
          <div className="relative min-w-0 overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF] xl:flex xl:h-full xl:flex-col">
            <div className="overflow-x-auto xl:flex-1 xl:overflow-auto">
              <table className="min-w-[1040px] w-full table-fixed text-left">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[14%]" />
                  <col className="w-[17%]" />
                  <col className="w-[23%]" />
                  <col className="w-[12%]" />
                  <col className="w-[4%]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#1F1B26] text-[10px] uppercase tracking-[0.14em] text-[#8F879D]">
                    <th className="border-b border-[#141119] px-5 py-3 font-medium">
                      Community
                    </th>
                    <th className="border-b border-[#141119] px-4 py-3 font-medium">
                      Lifecycle
                    </th>
                    <th className="border-b border-[#141119] px-4 py-3 font-medium">
                      Key stats
                    </th>
                    <th className="border-b border-[#141119] px-4 py-3 font-medium">
                      Setup progress
                    </th>
                    <th className="border-b border-[#141119] px-4 py-3 font-medium">
                      Attention
                    </th>
                    <th
                      className="border-b border-[#141119] px-4 py-3 font-medium"
                      aria-label="Open details"
                    />
                  </tr>
                </thead>

                <tbody>
                  {visibleCommunities.map((community) => {
                    const lifecycleState =
                      getCommunityLifecycleState(community);
                    const setupState = getSetupState(community);
                    const progressValue =
                      getCommunityProgressValue(community);
                    const attention = getAttentionState(community);
                    const selected = activeCommunity?.id === community.id;
                    const enabledFeatures = [
                      community.allowFrequentAccess
                        ? "Frequent access"
                        : null,
                      community.allowReservations ? "Reservations" : null,
                      community.allowMessages ? "Messages" : null,
                    ].filter(
                      (feature): feature is string => feature !== null,
                    );

                    return (
                      <tr
                        key={community.id}
                        tabIndex={0}
                        onClick={() => selectCommunity(community.id)}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" ||
                            event.key === " "
                          ) {
                            event.preventDefault();
                            selectCommunity(community.id);
                          }
                        }}
                        className={cn(
                          "cursor-pointer border-b border-[#141119] outline-none transition-colors last:border-b-0 hover:bg-white/[0.02] focus-visible:shadow-[inset_0_0_0_2px_#7553FF]",
                          selected &&
                            "bg-[rgba(117,83,255,0.075)] shadow-[inset_2px_0_0_#7553FF,inset_0_1px_0_rgba(117,83,255,0.35),inset_0_-1px_0_rgba(117,83,255,0.35)]",
                        )}
                      >
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[rgba(117,83,255,0.28)] bg-[rgba(117,83,255,0.08)] text-xs font-semibold text-[#E3DEFF]">
                              {getInitials(community.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {community.name}
                              </p>
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#A9A3B2]">
                                <MapPin
                                  className="size-3.5 shrink-0"
                                  aria-hidden
                                />
                                <span className="truncate">
                                  {community.city || "Not set"}
                                </span>
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {enabledFeatures.length > 0 ? (
                                  enabledFeatures.map((feature) => (
                                    <FeatureChip key={feature}>
                                      {feature}
                                    </FeatureChip>
                                  ))
                                ) : (
                                  <FeatureChip>No optional modules</FeatureChip>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <StatusChip
                            className={getLifecycleChipClass(
                              lifecycleState,
                            )}
                          >
                            {getCommunityLifecycleLabel(lifecycleState)}
                          </StatusChip>
                          <p className="mt-2 text-xs text-[#8F879D]">
                            {setupState.label}
                          </p>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.12em] text-[#8F879D]">
                                Units
                              </p>
                              <p className="mt-1 text-base font-semibold text-white">
                                {community.totalUnits}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.12em] text-[#8F879D]">
                                Members
                              </p>
                              <p className="mt-1 text-base font-semibold text-white">
                                {community.totalMembers}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-white">
                                {community.onboardingStatus ===
                                "complete_active"
                                  ? "Setup complete"
                                  : "Setup in progress"}
                              </p>
                              <p className="mt-1 text-[11px] text-[#A9A3B2]">
                                {community.completedTasks} /{" "}
                                {community.totalTasks || 0} tasks
                              </p>
                            </div>
                            <span className="text-[11px] text-[#A9A3B2]">
                              {progressValue}%
                            </span>
                          </div>
                          <div className="mt-2 h-1 rounded-full bg-white/[0.08]">
                            <div
                              className={cn(
                                "h-1 rounded-full",
                                setupState.progressTone,
                              )}
                              style={{
                                width: getProgressWidth(
                                  community.completedTasks,
                                  community.totalTasks,
                                ),
                              }}
                            />
                          </div>
                          <p className="mt-2 line-clamp-1 text-[11px] text-[#8F879D]">
                            Next step:{" "}
                            {getOnboardingNextStepLabel(
                              community.nextStepKey,
                            )}
                          </p>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <span
                              className={cn(
                                "mt-1 size-2 shrink-0 rounded-full",
                                attention.dot,
                              )}
                            />
                            <div>
                              <p className="text-xs font-semibold text-white">
                                {attention.label}
                              </p>
                              <p className="mt-1 text-[11px] leading-4 text-[#8F879D]">
                                {attention.note}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-middle text-right">
                          <ChevronRight
                            className={cn(
                              "ml-auto size-4",
                              selected
                                ? "text-[#D8D1FF]"
                                : "text-[#8F879D]",
                            )}
                            aria-hidden
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {activeCommunity ? (
            <CommunityDrawer
              community={activeCommunity}
              drawerTab={drawerTab}
              onChangeTab={setDrawerTab}
              onClose={() => setSelectedId(null)}
              onOpenStatusModal={openStatusModal}
            />
          ) : null}
        </section>
      ) : (
        <section className="relative rounded-[10px] border border-[#141119] bg-[#24202B] px-5 py-12 text-center before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]">
          <p className="text-lg font-semibold text-white">
            No communities match this view
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#A9A3B2]">
            Clear the search or lifecycle filter to show communities again.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setLifecycleFilter("all");
            }}
            className="mt-5 rounded-[7px] border border-[#141119] bg-[#2E2936] px-4 py-2 text-sm font-semibold text-white"
          >
            Clear filters
          </button>
        </section>
      )}

      {pendingAction ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[10px] border border-[#141119] bg-[#24202B] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
                  Community status
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {pendingAction.nextIsActive
                    ? "Reactivate community?"
                    : "Deactivate community?"}
                </h2>
              </div>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#A9A3B2] hover:text-white"
                onClick={closeStatusModal}
                disabled={isPending}
                aria-label="Close"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-[#141119] bg-[#2E2936] p-4">
              <p className="text-base font-semibold text-white">
                {pendingAction.community.name}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#A9A3B2]">
                {pendingAction.nextIsActive
                  ? "Reactivating this community restores the users and assignments disabled by the community suspension. Manually disabled users remain inactive."
                  : "This blocks access for residents, guards, and community admins. Data is preserved and the community can be reactivated later."}
              </p>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-[#E7E5EA]">
                Type {expectedConfirmation} to confirm
              </span>
              <input
                value={confirmationText}
                onChange={(event) =>
                  setConfirmationText(event.target.value)
                }
                className="mt-2 h-11 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] px-4 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
                placeholder={expectedConfirmation}
                disabled={isPending}
              />
            </label>

            {errorMessage ? (
              <p className="mt-4 rounded-md border border-[rgba(255,102,126,0.24)] bg-[rgba(255,102,126,0.07)] px-4 py-3 text-sm font-semibold text-[#FFC1CB]">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeStatusModal}
                disabled={isPending}
                className="h-9 rounded-[7px] border border-[#141119] bg-[#2E2936] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitStatusChange}
                disabled={!canSubmit || isPending}
                className={cn(
                  "h-9 rounded-[7px] border px-4 text-sm font-semibold disabled:opacity-50",
                  pendingAction.nextIsActive
                    ? "border-[#120539] bg-[#7553FF] text-white shadow-[0_2px_0_#120539]"
                    : "border-[#4A1C26] bg-[#3A1A21] text-[#FFC1CB] shadow-[0_2px_0_#261016]",
                )}
              >
                {isPending
                  ? "Working..."
                  : pendingAction.nextIsActive
                    ? "Reactivate community"
                    : "Deactivate community"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CommunityDrawer({
  community,
  drawerTab,
  onChangeTab,
  onClose,
  onOpenStatusModal,
}: {
  community: CommunityListItem;
  drawerTab: DrawerTab;
  onChangeTab: (tab: DrawerTab) => void;
  onClose: () => void;
  onOpenStatusModal: (
    community: CommunityListItem,
    nextIsActive: boolean,
  ) => void;
}) {
  const lifecycleState = getCommunityLifecycleState(community);
  const setupState = getSetupState(community);
  const progressValue = getCommunityProgressValue(community);
  const stages = buildSetupStages(community);
  const enabledFeatures = [
    community.allowFrequentAccess ? "Frequent access" : null,
    community.allowReservations ? "Reservations" : null,
    community.allowMessages ? "Messages" : null,
  ].filter((feature): feature is string => feature !== null);

  const primaryLabel =
    community.onboardingStatus === "complete_active"
      ? "Open community"
      : setupState.label === "Needs attention"
        ? "Review setup"
        : "Continue setup";

  return (
    <aside className="flex overflow-hidden rounded-[10px] border border-[#141119] bg-[#26222F] shadow-[0_18px_40px_rgba(0,0,0,0.22)] xl:h-full xl:min-h-0 xl:flex-col">
      <div className="shrink-0 border-b border-[#141119] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[rgba(117,83,255,0.30)] bg-[rgba(117,83,255,0.09)] text-sm font-semibold text-[#E3DEFF]">
              {getInitials(community.name)}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-white">
                {community.name}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#A9A3B2]">
                <MapPin className="size-3.5" aria-hidden />
                <span>{community.city || "Not set"}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#8F879D] hover:text-white"
            aria-label="Close details"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <StatusChip className={getLifecycleChipClass(lifecycleState)}>
            {getCommunityLifecycleLabel(lifecycleState)}
          </StatusChip>
          <StatusChip className={getSetupChipClass(setupState.tone)}>
            {setupState.label}
          </StatusChip>
          {enabledFeatures.map((feature) => (
            <FeatureChip key={feature}>{feature}</FeatureChip>
          ))}
        </div>

        <div className="mt-5 flex border-b border-[#141119]">
          {[
            ["overview", "Overview"],
            ["setup", "Setup"],
            ["users", "Users"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onChangeTab(value as DrawerTab)}
              className={cn(
                "relative px-3 py-2 text-xs font-semibold",
                drawerTab === value
                  ? "text-white after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-[#7553FF]"
                  : "text-[#8F879D] hover:text-[#E7E5EA]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {drawerTab === "overview" ? (
          <>
            <section className="rounded-lg border border-white/[0.08] bg-white/[0.012] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Setup progress
                  </p>
                  <p className="mt-1 text-xs text-[#A9A3B2]">
                    {community.completedTasks} / {community.totalTasks || 0} tasks
                  </p>
                </div>
                <span className="text-sm font-semibold text-white">
                  {progressValue}%
                </span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/[0.08]">
                <div
                  className={cn(
                    "h-1.5 rounded-full",
                    setupState.progressTone,
                  )}
                  style={{
                    width: getProgressWidth(
                      community.completedTasks,
                      community.totalTasks,
                    ),
                  }}
                />
              </div>
              <p className="mt-3 text-xs text-[#8F879D]">
                Next step:{" "}
                {getOnboardingNextStepLabel(community.nextStepKey)}
              </p>
            </section>

            <SetupStages
              stages={stages}
              currentCompleted={community.completedTasks}
            />

            <KeyDetails community={community} />
          </>
        ) : null}

        {drawerTab === "setup" ? (
          <>
            <section className="rounded-lg border border-[#7553FF] bg-[linear-gradient(to_right,#7553FF_0,#7553FF_40px,rgba(72,40,184,0.58)_40px,rgba(72,40,184,0.58)_41px,transparent_41px),linear-gradient(#2E2936,#2E2936)] py-3 pl-14 pr-3">
              <p className="text-[11px] font-semibold text-[#D8D1FF]">
                Current setup state
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {setupState.label}
              </p>
              <p className="mt-2 text-xs leading-5 text-[#D3CEDA]">
                Next step:{" "}
                {getOnboardingNextStepLabel(community.nextStepKey)}
              </p>
            </section>

            <SetupStages
              stages={stages}
              currentCompleted={community.completedTasks}
            />
          </>
        ) : null}

        {drawerTab === "users" ? (
          <section className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatPanel
                icon={Users}
                label="Residents"
                value={String(community.totalMembers)}
              />
              <StatPanel
                icon={Building2}
                label="Units"
                value={String(community.totalUnits)}
              />
              <StatPanel
                icon={Clock3}
                label="In queue"
                value={String(community.activationPendingCount)}
              />
              <StatPanel
                icon={Tag}
                label="Unit label"
                value={formatUnitLabel(community.unitLabel)}
              />
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-white/[0.012] p-4">
              <p className="text-sm font-semibold text-white">
                Users & access
              </p>
              <p className="mt-2 text-xs leading-5 text-[#A9A3B2]">
                Manage resident, admin, and guard accounts, including roles,
                login identities, account status, and unit assignment.
              </p>
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => onOpenStatusModal(community, !community.isActive)}
          className={cn(
            "mt-4 text-xs font-semibold",
            community.isActive
              ? "text-[#E99AA7] hover:text-[#FFC1CB]"
              : "text-[#8EE2B9] hover:text-[#B8F0D0]",
          )}
        >
          {community.isActive
            ? "Deactivate community"
            : "Reactivate community"}
        </button>
      </div>

      <div className="shrink-0 border-t border-[#141119] bg-[#26222F] p-4">
        <div className="grid gap-2">
          <DimensionalLink
            href={getCommunityHref(community.id)}
            className="w-full"
          >
            {primaryLabel}
            <ChevronRight className="size-3.5" aria-hidden />
          </DimensionalLink>

          <div className="grid grid-cols-2 gap-2">
            <DimensionalLink
              href={getCommunityHref(community.id)}
              variant="secondary"
              className="w-full"
            >
              Open community
            </DimensionalLink>
            <DimensionalLink
              href={
                community.activationPendingCount > 0
                  ? getActivationQueueHref(community.id)
                  : getUsersHref(community.id)
              }
              variant="secondary"
              className="w-full"
            >
              {community.activationPendingCount > 0
                ? "Activation queue"
                : "Manage users"}
            </DimensionalLink>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SetupStages({
  stages,
  currentCompleted,
}: {
  stages: Array<{ done: boolean; label: string }>;
  currentCompleted: number;
}) {
  return (
    <section className="mt-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
      <div className="border-b border-white/[0.07] px-4 py-3">
        <p className="text-sm font-semibold text-white">Setup stage</p>
      </div>
      <div className="px-4 py-2">
        {stages.map((stage, index) => {
          const active = !stage.done && index === currentCompleted;

          return (
            <div
              key={stage.label + "-" + index}
              className="relative flex min-h-9 items-center gap-3"
            >
              {index < stages.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[6px] top-5 h-[calc(100%-8px)] w-px",
                    stage.done
                      ? "bg-[rgba(117,83,255,0.42)]"
                      : "bg-white/10",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 grid size-3.5 shrink-0 place-items-center rounded-full border text-[8px]",
                  stage.done
                    ? "border-[#7553FF] bg-[#7553FF] text-white"
                    : active
                      ? "border-[#7553FF] bg-[#2E2936] shadow-[0_0_0_3px_rgba(117,83,255,0.12)]"
                      : "border-white/20 bg-[#2E2936]",
                )}
              >
                {stage.done ? "✓" : ""}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 text-xs",
                  active ? "text-white" : "text-[#C9C4CF]",
                )}
              >
                {stage.label}
              </span>
              <span
                className={cn(
                  "rounded-[4px] border px-1.5 py-0.5 text-[10px] font-medium",
                  stage.done
                    ? "border-[rgba(103,215,165,0.18)] bg-[rgba(103,215,165,0.05)] text-[#8EE2B9]"
                    : active
                      ? "border-[rgba(228,194,106,0.18)] bg-[rgba(228,194,106,0.05)] text-[#F0D995]"
                      : "border-white/10 bg-white/[0.02] text-[#8F879D]",
                )}
              >
                {stage.done ? "Complete" : active ? "Pending" : "Waiting"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function KeyDetails({ community }: { community: CommunityListItem }) {
  const details = [
    {
      icon: Building2,
      label: "Units",
      value: String(community.totalUnits),
    },
    {
      icon: Users,
      label: "Members",
      value: String(community.totalMembers),
    },
    {
      icon: Clock3,
      label: "In queue",
      value: String(community.activationPendingCount),
    },
    {
      icon: Tag,
      label: "Unit label",
      value: formatUnitLabel(community.unitLabel),
    },
  ];

  return (
    <section className="mt-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
      <div className="border-b border-white/[0.07] px-4 py-3">
        <p className="text-sm font-semibold text-white">Key details</p>
      </div>
      <div className="grid grid-cols-2">
        {details.map((detail, index) => {
          const Icon = detail.icon;

          return (
            <div
              key={detail.label}
              className={cn(
                "flex gap-3 px-4 py-3",
                index % 2 === 0 && "border-r border-white/[0.07]",
                index < 2 && "border-b border-white/[0.07]",
              )}
            >
              <Icon
                className="mt-0.5 size-4 shrink-0 text-[#BEB4FF]"
                aria-hidden
              />
              <div>
                <p className="text-xs font-semibold text-white">
                  {detail.value}
                </p>
                <p className="mt-1 text-[10px] text-[#8F879D]">
                  {detail.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatPanel({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.012] p-4">
      <Icon className="size-4 text-[#BEB4FF]" aria-hidden />
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-[11px] text-[#8F879D]">{label}</p>
    </div>
  );
}
