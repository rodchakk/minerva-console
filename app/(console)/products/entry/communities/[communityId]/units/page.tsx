import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Filter,
  Home,
  MinusCircle,
  MoreVertical,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ResidentQuickCreate } from "@/features/entry/communities/ResidentQuickCreate";
import {
  getCommunityUnitsPageData,
  type CommunityUnitsStatusFilter,
} from "@/features/entry/communities/detailQueries";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";

const statusFilters: Array<{ label: string; value: CommunityUnitsStatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Occupied", value: "occupied" },
  { label: "No residents", value: "no_residents" },
  { label: "Pending activation", value: "pending_activation" },
];

const unitDisplayLimits = [6, 12, 24, 48] as const;

function buildUnitsHref(
  communityId: string,
  params: { limit?: number; q?: string; status?: CommunityUnitsStatusFilter },
) {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.limit && params.limit !== 6) search.set("limit", String(params.limit));
  const queryString = search.toString();
  return `/products/entry/communities/${communityId}/units${queryString ? `?${queryString}` : ""}`;
}

function Metric({
  hint,
  icon,
  label,
  tone = "info",
  value,
}: {
  hint: string;
  icon: ReactNode;
  label: string;
  tone?: "default" | "success" | "warning" | "info";
  value: string | number;
}) {
  const iconClass = {
    default: "border-white/10 bg-white/6 text-slate-200",
    success: "border-emerald-400/20 bg-emerald-500/12 text-emerald-300",
    warning: "border-amber-400/20 bg-amber-500/12 text-amber-300",
    info: "border-violet-400/20 bg-violet-500/12 text-violet-200",
  }[tone];

  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_16px_42px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${iconClass}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{hint}</p>
    </article>
  );
}

function UnitIcon({ label }: { label: string }) {
  const normalized = label.trim().toLowerCase();
  const Icon = normalized.includes("casa") || normalized.includes("house") ? Home : Building2;

  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-violet-400/18 bg-violet-500/12 text-violet-200">
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

function unitLabelPlural(label: string) {
  const normalized = label.trim().toLowerCase();
  if (normalized === "casas") return "houses";
  if (normalized === "apartamentos") return "apartments";
  if (normalized === "condominios") return "condominiums";
  return label.toLowerCase();
}

export default async function CommunityUnitsPage(
  props: PageProps<"/products/entry/communities/[communityId]/units">,
) {
  const { communityId } = await props.params;
  const searchParams = await props.searchParams;
  const community = await getCommunityWithProgress(communityId);

  if (!community) notFound();

  const unitsData = await getCommunityUnitsPageData({
    communityId: community.id,
    q: typeof searchParams.q === "string" ? searchParams.q : undefined,
    status: typeof searchParams.status === "string" ? searchParams.status : undefined,
  });
  const rawLimit =
    typeof searchParams.limit === "string" ? Number(searchParams.limit) : NaN;
  const visibleLimit = unitDisplayLimits.includes(rawLimit as (typeof unitDisplayLimits)[number])
    ? (rawLimit as (typeof unitDisplayLimits)[number])
    : 6;
  const visibleItems = unitsData.filteredItems.slice(0, visibleLimit);
  const hasFilters = Boolean(unitsData.query) || unitsData.status !== "all";

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200">
            MINERVA CONSOLE <span className="text-[var(--text-muted)]">·</span> ENTRY
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Units</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Manage houses, apartments, and their residents for this community.
          </p>
          <h2 className="mt-5 text-2xl font-semibold text-white">{community.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/products/entry/communities/${community.id}`}>
            <Button variant="secondary">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to community
            </Button>
          </Link>
          <Link href={`/products/entry/activation?community_id=${community.id}`}>
            <Button variant="secondary">Activation queue</Button>
          </Link>
          <Link href={`/products/entry/communities/${community.id}/units/new`}>
            <Button variant="secondary">Add unit</Button>
          </Link>
          <ResidentQuickCreate communityId={community.id} houses={unitsData.houses} />
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Total units"
          value={unitsData.summary.totalUnits}
          hint={`All ${unitLabelPlural(community.unitLabel)} in this community`}
          icon={<Building2 className="h-5 w-5" aria-hidden />}
        />
        <Metric
          label="Active units"
          value={unitsData.summary.activeUnits}
          hint="Currently active"
          tone="success"
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
        />
        <Metric
          label="Inactive units"
          value={unitsData.summary.inactiveUnits}
          hint="Currently inactive"
          tone="default"
          icon={<MinusCircle className="h-5 w-5" aria-hidden />}
        />
        <Metric
          label="Residents"
          value={unitsData.summary.activeResidents}
          hint="Across active accounts"
          icon={<UserRound className="h-5 w-5" aria-hidden />}
        />
        <Metric
          label="Pending activations"
          value={unitsData.summary.pendingActivations}
          hint="Residents to activate"
          tone="warning"
          icon={<Clock3 className="h-5 w-5" aria-hidden />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-semibold text-white">Unit directory</h3>
              <form className="mt-4 flex min-w-0 items-center gap-3">
                <label className="relative block w-full max-w-3xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
                  <input
                    name="q"
                    defaultValue={unitsData.query}
                    placeholder="Search unit, resident, or owner"
                    className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/50"
                  />
                </label>
                <input type="hidden" name="status" value={unitsData.status} />
                <input type="hidden" name="limit" value={String(visibleLimit)} />
                <Button type="submit" variant="secondary">
                  <Search className="mr-2 h-4 w-4" aria-hidden />
                  Search
                </Button>
              </form>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Filter className="h-4 w-4" aria-hidden />
              <span>{unitsData.totalMatching} matching</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {statusFilters.map((filter) => {
              const active = unitsData.status === filter.value;
              return (
                <Link
                  key={filter.value}
                  href={buildUnitsHref(community.id, {
                    limit: visibleLimit,
                    q: unitsData.query,
                    status: filter.value,
                  })}
                  className={[
                    "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                    active
                      ? "border-violet-400/30 bg-violet-500/16 text-white"
                      : "border-[var(--border)] bg-white/[0.03] text-[var(--text-muted)] hover:text-white",
                  ].join(" ")}
                >
                  {filter.label}
                </Link>
              );
            })}
            {hasFilters ? (
              <Link
                href={buildUnitsHref(community.id, {})}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:text-white"
              >
                Clear
              </Link>
            ) : null}
          </div>

          {unitsData.state === "unavailable" ? (
            <div className="mt-5 rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center">
              <p className="font-semibold text-white">Units unavailable</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                The unit directory could not be loaded right now.
              </p>
            </div>
          ) : unitsData.items.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center">
              <p className="font-semibold text-white">No units created yet.</p>
              <div className="mt-4">
                <Link href={`/products/entry/communities/${community.id}/units/new`}>
                  <Button>Add unit</Button>
                </Link>
              </div>
            </div>
          ) : unitsData.filteredItems.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center">
              <p className="font-semibold text-white">No units match these filters.</p>
              <div className="mt-4">
                <Link href={buildUnitsHref(community.id, {})}>
                  <Button variant="secondary">Clear filters</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-lg border border-white/8">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-white/[0.03] text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Primary resident</th>
                    <th className="px-4 py-3">Residents</th>
                    <th className="px-4 py-3">Pending</th>
                    <th className="px-4 py-3">Active passes</th>
                    <th className="px-4 py-3">Last access</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {visibleItems.map((unit) => (
                    <tr key={unit.id} className="bg-[var(--surface-strong)] text-slate-200">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UnitIcon label={unit.label} />
                          <span className="font-semibold text-white">{unit.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{unit.primaryResidentName || "No residents"}</td>
                      <td className="px-4 py-3">{unit.activeResidents}</td>
                      <td className="px-4 py-3">{unit.pendingActivations}</td>
                      <td className="px-4 py-3">{unit.activePasses}</td>
                      <td className="px-4 py-3">
                        {unit.lastAccess === "Not available" ? "No access recorded" : unit.lastAccess}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={unit.isActive ? "success" : "default"}>
                          {unit.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/products/entry/communities/${community.id}/units/${unit.id}`}>
                            <Button type="button" variant="secondary">View details</Button>
                          </Link>
                          <button
                            type="button"
                            className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-muted)]"
                            aria-label={`More actions for ${unit.label}`}
                          >
                            <MoreVertical className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--text-muted)]">
            <span>Showing {visibleItems.length} of {unitsData.totalMatching} units</span>
            <form action={`/products/entry/communities/${community.id}/units`} className="flex items-center gap-2">
              <input type="hidden" name="q" value={unitsData.query} />
              <input type="hidden" name="status" value={unitsData.status} />
              <span>Show</span>
              <select
                name="limit"
                defaultValue={String(visibleLimit)}
                className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-2 text-sm text-white outline-none"
              >
                {unitDisplayLimits.map((limit) => (
                  <option key={limit} value={String(limit)}>
                    {limit}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary">Apply</Button>
            </form>
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-violet-400/20 bg-violet-500/12 text-violet-200">
            <DoorOpen className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="mt-5 text-lg font-semibold text-white">Keep your units up to date</h3>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Add residents to units so they can access the community. New residents appear after they are assigned to a unit.
          </p>
          <div className="mt-5">
            <ResidentQuickCreate
              communityId={community.id}
              houses={unitsData.houses}
              triggerClassName="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/12 px-3.5 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/18"
            />
          </div>
          <Link
            href={`/products/entry/activation?community_id=${community.id}`}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-200 transition hover:text-white"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Review activation queue
          </Link>
        </aside>
      </section>
    </div>
  );
}
