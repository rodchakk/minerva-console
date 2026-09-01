import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  History,
  Home,
  Info,
  KeyRound,
  ListChecks,
  Shield,
  UserRound,
  UsersRound,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CommunityUnitQuickActions } from "@/features/entry/communities/CommunityUnitQuickActions";
import { ResidentQuickCreate } from "@/features/entry/communities/ResidentQuickCreate";
import { UnitResidentActions } from "@/features/entry/communities/UnitResidentActions";
import {
  getCommunityUnitDetailPageData,
  type CommunityUnitResident,
} from "@/features/entry/communities/detailQueries";
import { getUsersLastSignIn } from "@/features/entry/users/lastSignIn";

type ResidentStatusFilter = "all" | "active" | "pending" | "inactive";

const residentFilters: Array<{ label: string; value: ResidentStatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Inactive", value: "inactive" },
];

function formatMetricValue(value: string) {
  return value === "Not available" ? "No access recorded" : value;
}

function formatLastSignIn(value?: string | null) {
  if (!value) return "Never signed in";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never signed in";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getUnitTypeLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  if (normalized === "casas") return "Casa";
  if (normalized === "condominios") return "Condo";
  if (normalized === "apartamentos") return "Apto";
  if (normalized === "oficinas") return "Oficina";
  return label.trim() || "Unit";
}

function formatUnitDisplayLabel(label: string, unitType: string) {
  const trimmedLabel = label.trim();
  const trimmedType = getUnitTypeLabel(unitType);

  if (!trimmedLabel) return trimmedType;
  if (trimmedLabel.toLowerCase().includes(trimmedType.toLowerCase())) {
    return trimmedLabel;
  }

  return `${trimmedType} ${trimmedLabel}`.trim();
}

function buildUnitHref(
  communityId: string,
  unitId: string,
  params: { q?: string; status?: ResidentStatusFilter },
) {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.status && params.status !== "all") search.set("status", params.status);
  const queryString = search.toString();
  return `/products/entry/communities/${communityId}/units/${unitId}${queryString ? `?${queryString}` : ""}`;
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
    <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${iconClass}`}>
          {icon}
        </span>
        <div>
          <p className="text-sm font-medium text-slate-100">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{hint}</p>
    </article>
  );
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "R";
}

function roleLabel(role: string) {
  if (role === "ADMIN") return "Resident admin";
  if (role === "RESIDENT") return "Resident";
  if (role === "UNASSIGNED") return "Unassigned";
  return role;
}

function residentStatus(resident: CommunityUnitResident) {
  if (resident.isActive) return "Active";
  return "Inactive";
}

function getResidentStatusTone(resident: CommunityUnitResident) {
  return resident.isActive ? "success" : "default";
}

function filterResidents(
  residents: CommunityUnitResident[],
  query: string,
  status: ResidentStatusFilter,
) {
  const normalizedQuery = query.trim().toLowerCase();

  return residents.filter((resident) => {
    const matchesQuery =
      !normalizedQuery ||
      [
        resident.fullName,
        resident.account,
        resident.email,
        resident.username,
        resident.phone,
        resident.role,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    if (!matchesQuery) return false;
    if (status === "active") return resident.isActive;
    if (status === "inactive") return !resident.isActive;
    if (status === "pending") return false;
    return true;
  });
}

function normalizeResidentFilter(value: string | undefined): ResidentStatusFilter {
  if (value === "active" || value === "pending" || value === "inactive") return value;
  return "all";
}

export default async function CommunityUnitDetailPage(
  props: PageProps<"/products/entry/communities/[communityId]/units/[unitId]">,
) {
  const { communityId, unitId } = await props.params;
  const searchParams = await props.searchParams;
  const data = await getCommunityUnitDetailPageData(communityId, unitId);

  if (!data.community) notFound();

  const community = data.community;

  if (data.state !== "unavailable" && !data.unit) notFound();

  if (data.state === "unavailable" || !data.unit) {
    return (
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200">
              MINERVA CONSOLE <span className="text-[var(--text-muted)]">·</span> ENTRY
            </p>
            <h1 className="mt-4 text-3xl font-semibold text-white">Unit unavailable</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              The unit directory could not be loaded right now.
            </p>
          </div>
          <Link href={`/products/entry/communities/${community.id}/units`}>
            <Button variant="secondary">Back to units</Button>
          </Link>
        </header>
      </div>
    );
  }

  const unit = data.unit;
  const lastSignInByUserId = await getUsersLastSignIn(
    unit.residents.map((resident) => resident.userId),
  );
  const unitDisplayLabel = formatUnitDisplayLabel(unit.label, community.unitLabel);
  const residentQuery = typeof searchParams.q === "string" ? searchParams.q : "";
  const residentFilter = normalizeResidentFilter(
    typeof searchParams.status === "string" ? searchParams.status : undefined,
  );
  const filteredResidents = filterResidents(
    unit.residents,
    residentQuery,
    residentFilter,
  );
  const normalizedResidentQuery = residentQuery.trim().toLowerCase();
  const filteredPendingActivations =
    residentFilter === "all" || residentFilter === "pending"
      ? unit.pendingActivationItems.filter((activation) =>
          !normalizedResidentQuery ||
          [activation.residentName, activation.method, activation.status]
            .join(" ")
            .toLowerCase()
            .includes(normalizedResidentQuery),
        )
      : [];
  const pendingCount = unit.pendingActivations;
  const activeAccounts = unit.residents.filter((resident) => resident.isActive).length;
  const lastAccess = formatMetricValue(unit.lastAccess);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200">
            MINERVA CONSOLE <span className="text-[var(--text-muted)]">·</span> ENTRY
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">{unitDisplayLabel}</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Manage residents, access, and operational details for this unit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/products/entry/communities/${community.id}/units`}>
            <Button variant="secondary">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to units
            </Button>
          </Link>
          <Link href={`/products/entry/communities/${community.id}`}>
            <Button variant="secondary">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to community
            </Button>
          </Link>
          <ResidentQuickCreate
            communityId={community.id}
            fixedUnitId={unit.id}
            houses={data.houses}
            triggerLabel="Add resident"
          />
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-lg border border-violet-400/20 bg-violet-500/12 text-violet-200">
              {unitDisplayLabel.toLowerCase().startsWith("casa") ? (
                <Home className="h-7 w-7" aria-hidden />
              ) : (
                <Building2 className="h-7 w-7" aria-hidden />
              )}
            </span>
            <div>
              <p className="font-semibold text-white">{community.name}</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">{unitDisplayLabel}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="info">ENTRY unit</Badge>
                <Badge tone={unit.isActive ? "success" : "default"}>
                  {unit.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge tone="info">{getUnitTypeLabel(community.unitLabel)}</Badge>
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-violet-200" aria-hidden />
            <h3 className="font-semibold text-white">Unit information</h3>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Unit", unitDisplayLabel],
              ["Type", getUnitTypeLabel(community.unitLabel)],
              ["Community", community.name],
              ["Primary resident", unit.primaryResidentName || "No residents"],
              ["Status", unit.isActive ? "Active" : "Inactive"],
              ["Created", unit.createdAt],
              ["Last access", lastAccess],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-[var(--text-muted)]">{label}</dt>
                <dd className="text-right font-medium text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Residents"
          value={unit.residentCount}
          hint="Linked to this unit"
          icon={<UsersRound className="h-5 w-5" aria-hidden />}
        />
        <Metric
          label="Active accounts"
          value={activeAccounts}
          hint="Currently active"
          tone="success"
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
        />
        <Metric
          label="Pending activations"
          value={pendingCount}
          hint="Awaiting activation"
          tone="warning"
          icon={<Clock3 className="h-5 w-5" aria-hidden />}
        />
        <Metric
          label="Active passes"
          value={unit.activePasses}
          hint="Currently valid"
          icon={<CreditCard className="h-5 w-5" aria-hidden />}
        />
        <Metric
          label="Last access"
          value={lastAccess}
          hint="Most recent activity"
          tone={unit.lastAccess === "Not available" ? "default" : "success"}
          icon={<History className="h-5 w-5" aria-hidden />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Residents in this unit</h3>
                <form className="mt-3 flex items-center gap-3">
                  <input
                    name="q"
                    defaultValue={residentQuery}
                    placeholder="Search residents"
                    className="h-10 w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/50"
                  />
                  <input type="hidden" name="status" value={residentFilter} />
                  <Button type="submit" variant="secondary">Search</Button>
                </form>
              </div>
              <div className="flex flex-wrap gap-2">
                {residentFilters.map((filter) => (
                  <Link
                    key={filter.value}
                    href={buildUnitHref(community.id, unit.id, {
                      q: residentQuery,
                      status: filter.value,
                    })}
                    className={[
                      "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                      residentFilter === filter.value
                        ? "border-violet-400/30 bg-violet-500/16 text-white"
                        : "border-[var(--border)] bg-white/[0.03] text-[var(--text-muted)] hover:text-white",
                    ].join(" ")}
                  >
                    {filter.label}
                  </Link>
                ))}
              </div>
            </div>

            {unit.residents.length === 0 && filteredPendingActivations.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center">
                <p className="font-semibold text-white">No residents linked to this unit.</p>
                <div className="mt-4">
                  <ResidentQuickCreate
                    communityId={community.id}
                    fixedUnitId={unit.id}
                    houses={data.houses}
                    triggerLabel="Add resident"
                  />
                </div>
              </div>
            ) : filteredResidents.length === 0 && filteredPendingActivations.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center">
                <p className="font-semibold text-white">No residents match these filters.</p>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-lg border border-white/8">
                <table className="min-w-[820px] w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Resident</th>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Last sign-in</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {filteredResidents.map((resident) => (
                      <tr key={resident.userId} className="bg-[var(--surface-strong)]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="grid h-8 w-8 place-items-center rounded-lg border border-violet-400/20 bg-violet-500/12 text-xs font-semibold text-violet-100">
                              {getInitials(resident.fullName)}
                            </span>
                            <span className="font-semibold text-white">{resident.fullName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-200">{resident.account}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-slate-200">
                            {resident.role === "ADMIN" ? (
                              <Shield className="h-4 w-4 text-violet-200" aria-hidden />
                            ) : (
                              <UserRound className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />
                            )}
                            {roleLabel(resident.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-200">
                          {formatLastSignIn(lastSignInByUserId[resident.userId])}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={getResidentStatusTone(resident)}>
                            {residentStatus(resident)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <UnitResidentActions
                              communityId={community.id}
                              resident={resident}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredPendingActivations.map((activation) => (
                      <tr key={activation.id} className="bg-[var(--surface-strong)]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/20 bg-amber-500/12 text-xs font-semibold text-amber-100">
                              {getInitials(activation.residentName)}
                            </span>
                            <span className="font-semibold text-white">{activation.residentName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-200">{activation.method}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-slate-200">
                            <Clock3 className="h-4 w-4 text-amber-300" aria-hidden />
                            Pending activation
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-200">Not activated</td>
                        <td className="px-4 py-3">
                          <Badge tone="warning">Pending activation</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/products/entry/activation?community_id=${community.id}`}>
                            <Button type="button" variant="secondary">Review</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-violet-200" aria-hidden />
                <h3 className="font-semibold text-white">Recent access</h3>
              </div>
              {unit.lastAccess === "Not available" ? (
                <p className="mt-5 rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-[var(--text-muted)]">
                  No access recorded.
                </p>
              ) : (
                <div className="mt-5 rounded-lg border border-white/8 bg-[var(--surface-strong)] px-4 py-3">
                  <p className="font-semibold text-white">{unit.primaryResidentName || unit.label}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Most recent unit access</p>
                  <p className="mt-3 text-sm text-white">{lastAccess}</p>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-violet-200" aria-hidden />
                <h3 className="font-semibold text-white">Active passes</h3>
              </div>
              {unit.activePassItems.length === 0 && unit.activePasses === 0 ? (
                <p className="mt-5 rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-[var(--text-muted)]">
                  No active passes.
                </p>
              ) : unit.activePassItems.length === 0 ? (
                <p className="mt-5 rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-[var(--text-muted)]">
                  {unit.activePasses} active pass{unit.activePasses === 1 ? "" : "es"} reported. Pass details are unavailable.
                </p>
              ) : (
                <>
                  {unit.activePasses > unit.activePassItems.length ? (
                    <p className="mt-5 rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[var(--text-muted)]">
                      {unit.activePasses - unit.activePassItems.length} additional active pass
                      {unit.activePasses - unit.activePassItems.length === 1 ? "" : "es"} reported.
                    </p>
                  ) : null}
                  <div className="mt-5 overflow-x-auto rounded-lg border border-white/8">
                    <table className="min-w-[520px] w-full text-left text-sm">
                      <thead className="bg-white/[0.03] text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        <tr>
                          <th className="px-3 py-3">Pass</th>
                          <th className="px-3 py-3">Resident</th>
                          <th className="px-3 py-3">Expires</th>
                          <th className="px-3 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/8">
                        {unit.activePassItems.map((pass) => (
                          <tr key={pass.id} className="bg-[var(--surface-strong)]">
                            <td className="px-3 py-3 text-white">{pass.passName}</td>
                            <td className="px-3 py-3 text-slate-200">{pass.holderName}</td>
                            <td className="px-3 py-3 text-slate-200">{pass.expiresAt}</td>
                            <td className="px-3 py-3">
                              <Badge tone="success">{pass.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-violet-200" aria-hidden />
              <h3 className="font-semibold text-white">Quick actions</h3>
            </div>
            <div className="mt-4 space-y-2">
              <ResidentQuickCreate
                communityId={community.id}
                fixedUnitId={unit.id}
                houses={data.houses}
                triggerClassName="inline-flex w-full items-center justify-start gap-2 rounded-lg border border-violet-400/30 bg-violet-500/12 px-3.5 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/18"
                triggerLabel="Add resident"
              />
              <Link
                href={`/products/entry/activation?community_id=${community.id}`}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/5"
              >
                <ListChecks className="h-4 w-4" aria-hidden />
                Activation queue
              </Link>
              <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                <CommunityUnitQuickActions communityId={community.id} unit={unit} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-violet-200" aria-hidden />
              <h3 className="font-semibold text-white">Need help?</h3>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
              Residents must be linked to this unit before they can access the community.
            </p>
          </section>
        </aside>
      </section>
    </div>
  );
}
