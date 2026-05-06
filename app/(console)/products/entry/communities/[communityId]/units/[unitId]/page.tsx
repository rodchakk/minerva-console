import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricCard } from "@/components/cards/MetricCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getCommunityUnitDetailPageData } from "@/features/entry/communities/detailQueries";

function formatMetricValue(value: string) {
  return value === "Not available" ? "No access yet" : value;
}

export default async function CommunityUnitDetailPage(
  props: PageProps<"/products/entry/communities/[communityId]/units/[unitId]">,
) {
  const { communityId, unitId } = await props.params;
  const data = await getCommunityUnitDetailPageData(communityId, unitId);

  if (!data.community) {
    notFound();
  }

  const community = data.community;

  if (data.state !== "unavailable" && !data.unit) {
    notFound();
  }

  if (data.state === "unavailable") {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Unit detail"
          description="Read-only operational view for this unit."
          actions={
            <div className="flex flex-wrap gap-3">
              <Link href={`/products/entry/communities/${community.id}/units`}>
                <Button variant="secondary">Back to units</Button>
              </Link>
              <Link href={`/products/entry/communities/${community.id}`}>
                <Button variant="secondary">Back to community</Button>
              </Link>
            </div>
          }
        />

        <section className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(112,104,255,0.14),rgba(17,24,39,0.92))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.28)] backdrop-blur xl:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="info">ENTRY unit</Badge>
                <Badge tone={community.isActive ? "success" : "default"}>
                  {community.isActive ? "Community active" : "Community inactive"}
                </Badge>
              </div>
              <div>
                <h2 className="text-3xl font-semibold text-white">
                  Unit detail unavailable
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  {community.name} · {community.city}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur xl:p-7">
          <p className="text-base font-semibold text-white">
            The unit directory could not be loaded right now.
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            The community overview is still available, but this unit record cannot
            be inspected until the units RPC responds again.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/products/entry/communities/${community.id}/units`}>
              <Button variant="secondary">Back to units</Button>
            </Link>
            <Link href={`/products/entry/communities/${community.id}`}>
              <Button>Back to community</Button>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const unit = data.unit;

  if (!unit) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={unit.label}
        description="Read-only operational view for this unit."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={`/products/entry/communities/${community.id}/units`}>
              <Button variant="secondary">Back to units</Button>
            </Link>
            <Link href={`/products/entry/communities/${community.id}`}>
              <Button variant="secondary">Back to community</Button>
            </Link>
          </div>
        }
      />

      <section className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(112,104,255,0.14),rgba(17,24,39,0.92))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.28)] backdrop-blur xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="info">ENTRY unit</Badge>
              <Badge tone={unit.isActive ? "success" : "default"}>
                {unit.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge tone="info">{community.unitLabel}</Badge>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                {community.name}
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-white">
                {unit.label}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {community.city}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[rgba(9,12,24,0.5)] px-5 py-4 xl:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
              Unit profile
            </p>
            <p className="mt-2 text-base font-semibold text-white">
              Read-only operational record for this {community.unitLabel.toLowerCase()}.
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Use this page to inspect occupancy, access signals, and future
              operational surfaces before edit tools are introduced.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active residents"
          value={String(unit.activeResidents)}
          hint="Residents currently counted against this unit."
          status="Live"
          tone="info"
        />
        <MetricCard
          label="Active passes"
          value={String(unit.activePasses)}
          hint="Passes currently linked to this unit."
          status="Live"
          tone={unit.activePasses > 0 ? "warning" : "info"}
        />
        <MetricCard
          label="Last access"
          value={formatMetricValue(unit.lastAccess)}
          hint="Most recent access timestamp returned by the unit RPC."
          status="Live"
          tone={unit.lastAccess === "Not available" ? "default" : "success"}
        />
        <MetricCard
          label="Created"
          value={unit.createdAt}
          hint="Unit creation timestamp returned by the current read-only source."
          status="Live"
          tone="info"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur xl:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                  Unit profile
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  Core operational details
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  Primary identity and current read-only unit state.
                </p>
              </div>
              <Badge tone={unit.isActive ? "success" : "default"}>
                {unit.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/8 bg-[var(--surface-strong)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Unit label
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {unit.label}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-[var(--surface-strong)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Owner
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {unit.ownerName || "No owner recorded"}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-[var(--surface-strong)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Community
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {community.name}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-[var(--surface-strong)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Unit label type
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {community.unitLabel}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-[var(--surface-strong)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Created
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {unit.createdAt}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-[var(--surface-strong)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Last access
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {formatMetricValue(unit.lastAccess)}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                Residents linked to this unit
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                Resident list by unit is coming soon.
              </p>
            </section>

            <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                Active passes
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {unit.activePasses}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Pass details are coming soon.
              </p>
            </section>

            <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                Recent access
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatMetricValue(unit.lastAccess)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Recent access timeline is coming soon.
              </p>
            </section>

            <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                Unit location support
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                Saved map coordinates and directions can be surfaced here once
                connected.
              </p>
            </section>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
              Actions
            </p>
            <div className="mt-4 space-y-3">
              {[
                "Edit unit",
                "Disable unit",
                "Manage residents",
                "View access history",
              ].map((label) => (
                <div
                  key={label}
                  className="rounded-[24px] border border-white/8 bg-white/4 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                        Coming soon
                      </p>
                    </div>
                    <Button type="button" variant="secondary" disabled>
                      Coming soon
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
