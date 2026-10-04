import Link from "next/link";
import { Rubik } from "next/font/google";
import {
  Archive,
  CheckCircle2,
  Clock3,
  Plus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  CommunityList,
  type CommunityDirectoryFilter,
} from "@/features/entry/communities/CommunityList";
import {
  isCommunityFullyActive,
  isCommunityPendingSetup,
} from "@/features/entry/communities/lifecycle";
import { listCommunitiesWithProgress } from "@/features/entry/communities/queries";
import { cn } from "@/lib/supabase/utils";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
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
      <span className="relative -translate-y-0.5 inline-flex items-center gap-2">
        {children}
      </span>
    </Link>
  );
}

function MetricItem({
  icon: Icon,
  label,
  value,
  note,
  dotClassName,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  note: string;
  dotClassName: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "grid min-h-[106px] grid-cols-[42px_minmax(0,1fr)] items-center gap-x-3 px-5 py-4",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full border border-white/[0.14] bg-white/[0.02] text-[#D8D3E7]">
        <Icon className="size-[18px] stroke-[1.7]" aria-hidden />
      </span>

      <div className="min-w-0">
        <p className="text-xs text-[#A9A3B2]">{label}</p>
        <p className="mt-1 text-2xl font-bold leading-none tracking-tight text-white">
          {value}
        </p>
      </div>

      <div className="col-start-2 mt-2 flex min-w-0 items-center gap-2 text-[11px] text-[#A9A3B2]">
        <span className={cn("size-1.5 shrink-0 rounded-full", dotClassName)} />
        <span className="truncate">{note}</span>
      </div>
    </article>
  );
}

export default async function CommunitiesPage(
  props: PageProps<"/products/entry/communities">,
) {
  const communities = await listCommunitiesWithProgress();
  const searchParams = await props.searchParams;
  const rawFilter = getSingleParam(searchParams.filter);
  const initialFilter: CommunityDirectoryFilter =
    rawFilter === "active" ||
    rawFilter === "pending_setup" ||
    rawFilter === "needs_attention" ||
    rawFilter === "inactive"
      ? rawFilter
      : "all";

  const totalCount = communities.length;
  const activeCount = communities.filter(isCommunityFullyActive).length;
  const pendingCount = communities.filter(isCommunityPendingSetup).length;
  const inactiveCount = communities.filter((community) => !community.isActive).length;

  return (
    <div
      className={cn(
        rubik.className,
        "relative -mx-4 -my-4 min-h-[calc(100vh-4rem)] space-y-4 bg-[#2E2936] px-4 py-5 text-[#E7E5EA] lg:-mx-6 lg:-my-5 lg:px-6 lg:py-5 2xl:-mx-7 2xl:px-7",
      )}
    >
      <section className="flex flex-col gap-5 pt-1 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
            ENTRY DIRECTORY
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white lg:text-[2.05rem]">
            ENTRY Communities
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#A9A3B2]">
            Directory and lifecycle management for all ENTRY communities.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <DimensionalActionLink href="/products/entry/communities/new">
            <Plus className="size-4 stroke-[1.9]" aria-hidden />
            Onboard new community
          </DimensionalActionLink>
          <DimensionalActionLink
            href="/products/entry/communities?filter=pending_setup"
            variant="secondary"
          >
            <Clock3 className="size-4 stroke-[1.9]" aria-hidden />
            View pending setup
          </DimensionalActionLink>
        </div>
      </section>

      {communities.length > 0 ? (
        <section className="relative grid overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF] md:grid-cols-2 xl:grid-cols-4">
          <MetricItem
            icon={UsersRound}
            label="Total communities"
            value={totalCount}
            note="Across all statuses"
            dotClassName="bg-[#7553FF]"
            className="border-b border-[#141119] md:border-r xl:border-b-0"
          />
          <MetricItem
            icon={CheckCircle2}
            label="Fully active"
            value={activeCount}
            note={
              totalCount > 0
                ? Math.round((activeCount / totalCount) * 100) + "% of total"
                : "No active communities"
            }
            dotClassName="bg-[#67D7A5]"
            className="border-b border-[#141119] xl:border-r xl:border-b-0"
          />
          <MetricItem
            icon={Clock3}
            label="Pending setup"
            value={pendingCount}
            note="Setup in progress"
            dotClassName="bg-[#F6C941]"
            className="border-b border-[#141119] md:border-r md:border-b-0 xl:border-r"
          />
          <MetricItem
            icon={Archive}
            label="Inactive communities"
            value={inactiveCount}
            note="Archived from main view"
            dotClassName="bg-[#8F879D]"
          />
        </section>
      ) : null}

      <CommunityList communities={communities} initialFilter={initialFilter} />
    </div>
  );
}
