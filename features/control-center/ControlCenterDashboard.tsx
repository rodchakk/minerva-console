import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Download,
  Lock,
  PackagePlus,
  Plus,
  Radio,
  Settings2,
} from "lucide-react";
import { getBrainCounts } from "@/features/brain/lib/content";
import {
  getEntryOperationalActivity,
  getEntryPublishedMessagesLast24Hours,
} from "@/features/entry/operations/queries";
import {
  integrationKitActions,
  productModules,
  type ProductModule,
  type ProductStatus,
} from "@/features/control-center/productRegistry";
import { cn } from "@/lib/supabase/utils";

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-white/[0.10] bg-[#181a1d] shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function ActionLink({
  href,
  children,
  emphasis = false,
}: {
  href: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff4d4d]/40",
        emphasis
          ? "border-white/[0.12] bg-white/[0.045] text-white hover:border-[#ff4d4d]/40 hover:bg-white/[0.07]"
          : "border-white/[0.10] bg-white/[0.025] text-slate-200 hover:border-white/[0.18] hover:bg-white/[0.045]",
      )}
    >
      {children}
    </Link>
  );
}

function StatusDot({ status }: { status: ProductStatus }) {
  const color =
    status === "operational"
      ? "bg-emerald-400"
      : status === "development"
        ? "bg-amber-400"
        : status === "locked"
          ? "bg-slate-500"
          : "bg-[#ff4d4d]";

  return <span className={cn("h-1.5 w-1.5 rounded-full", color)} />;
}

function SummaryCard({
  icon: Icon,
  label,
  note,
  value,
  warning = false,
}: {
  icon: typeof PackagePlus;
  label: string;
  note: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <Panel className="min-h-[112px] p-4">
      <div className="flex items-center gap-4">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-slate-200">
          <Icon className={cn("h-5 w-5 stroke-[1.75]", warning ? "text-amber-300" : "")} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--console-text-muted)]">{label}</p>
          <p className="mt-1 text-2xl font-semibold leading-7 text-white">{value}</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-[var(--console-text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff4d4d]" />
            <span className="truncate">{note}</span>
          </p>
        </div>
      </div>
    </Panel>
  );
}

function ProductCard({ product }: { product: ProductModule }) {
  const Icon = product.icon;
  const openHref = product.availability === "available" ? product.href : null;

  return (
    <article className="flex min-h-[184px] flex-col rounded-lg border border-white/[0.10] bg-white/[0.025] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/[0.10] bg-white/[0.04] text-slate-200">
            <Icon className="h-5 w-5 stroke-[1.75]" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">{product.name}</h3>
            <p className="mt-0.5 text-xs capitalize text-[var(--console-text-muted)]">
              {product.kind} product
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.035] px-2 py-1 text-xs font-medium text-slate-200">
          <StatusDot status={product.status} />
          {product.statusLabel}
        </span>
      </div>

      <p className="mt-3 min-h-[40px] text-sm leading-5 text-[var(--console-text-muted)]">
        {product.description}
      </p>

      <div className="mt-4 grid grid-cols-3 divide-x divide-white/[0.10] border-y border-white/[0.08] py-2">
        {product.metrics.map((metric) => (
          <div key={metric.label} className="px-3 first:pl-0 last:pr-0">
            <p className="truncate text-sm font-semibold text-white">{metric.value}</p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--console-text-muted)]">
              {metric.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4">
        {openHref ? (
          <Link
            href={openHref}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.10] bg-white/[0.045] text-sm font-semibold text-slate-100 transition-colors hover:border-white/[0.18] hover:bg-white/[0.07]"
          >
            Open module
            <ArrowUpRight className="h-4 w-4 stroke-[1.75]" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] text-sm font-semibold text-[var(--console-text-soft)]"
          >
            {product.availability === "restricted" ? (
              <Lock className="h-4 w-4 stroke-[1.75]" />
            ) : null}
            {product.availability === "restricted" ? "Restricted" : "Coming later"}
          </button>
        )}
      </div>
    </article>
  );
}

function AddProductCard() {
  return (
    <Link
      href="/products/add"
      className="flex min-h-[184px] flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.14] bg-white/[0.015] p-5 text-center transition-colors hover:border-[#ff4d4d]/35 hover:bg-white/[0.03]"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-slate-100">
        <Plus className="h-5 w-5 stroke-[1.75]" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-white">Add Product</h3>
      <p className="mt-2 max-w-[240px] text-sm leading-5 text-[var(--console-text-muted)]">
        Manual setup for a native module or external product connection.
      </p>
    </Link>
  );
}

function SectionHeader({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon?: typeof PackagePlus;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/[0.10] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 text-slate-300 stroke-[1.75]" /> : null}
          <h2 className="text-base font-semibold text-white">{title}</h2>
        </div>
        <p className="mt-1 text-sm leading-5 text-[var(--console-text-muted)]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function BrainOverviewPanel() {
  const counts = getBrainCounts();
  const items = [
    {
      count: counts.inbox,
      label: "Needs Attention",
      note: "Brain inbox items awaiting triage",
    },
    {
      count: counts.missions,
      label: "Missions",
      note: "Git-backed work ledger",
    },
    {
      count: counts.projects,
      label: "Continue Working",
      note: "Project records available in Brain",
    },
  ];

  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        action={
          <Link
            href="/brain"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white"
          >
            Open Brain
            <ArrowRight className="h-4 w-4 stroke-[1.75]" />
          </Link>
        }
        description="Private Minerva workspace, rendered only from Brain's own content seam."
        icon={BrainCircuit}
        title="Brain Overview"
      />
      <div className="space-y-2 p-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.label === "Needs Attention" ? "/brain/inbox" : "/brain/projects"}
            className="flex items-center justify-between gap-4 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-3 transition-colors hover:border-white/[0.14] hover:bg-white/[0.035]"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="mt-1 truncate text-xs text-[var(--console-text-muted)]">
                {item.note}
              </p>
            </div>
            <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.06] px-2 text-sm font-semibold text-slate-200">
              {item.count}
            </span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function RecentActivityPanel({
  activity,
}: {
  activity: Awaited<ReturnType<typeof getEntryOperationalActivity>>;
}) {
  const items = activity.items.slice(0, 5);

  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        action={
          <Link
            href="/products/entry"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white"
          >
            Open ENTRY activity
            <ArrowRight className="h-4 w-4 stroke-[1.75]" />
          </Link>
        }
        description="Latest available ENTRY operational events. This is not a universal product event stream yet."
        icon={Activity}
        title="Recent Activity"
      />
      <div className="divide-y divide-white/[0.08] px-5">
        {activity.state === "unavailable" ? (
          <div className="py-8 text-center">
            <p className="font-medium text-white">Activity temporarily unavailable</p>
            <p className="mt-1 text-sm text-[var(--console-text-muted)]">
              Existing ENTRY operational data could not be loaded safely.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-medium text-white">No recent activity available</p>
            <p className="mt-1 text-sm text-[var(--console-text-muted)]">
              Real product events will appear here when the existing source provides them.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.eventId} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-100">
                  {item.eventLabel}: {item.communityName}
                </p>
                <p className="mt-1 truncate text-xs text-[var(--console-text-muted)]">
                  {item.detail}
                </p>
              </div>
              <span className="inline-flex w-fit items-center rounded-md border border-white/[0.08] bg-white/[0.025] px-2 py-1 text-[11px] font-medium text-[var(--console-text-muted)]">
                ENTRY
              </span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function NewProductSetupPanel() {
  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        description="Everything needed to connect another product without automatic provisioning."
        icon={Settings2}
        title="New Product Setup"
      />
      <div className="space-y-3 p-4">
        {integrationKitActions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center justify-between gap-4 rounded-md border border-white/[0.10] bg-white/[0.025] px-3 py-3 transition-colors hover:border-[#ff4d4d]/30 hover:bg-white/[0.04]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Icon className="h-5 w-5 shrink-0 text-[#ff4d4d] stroke-[1.75]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{action.label}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--console-text-muted)]">
                    {action.description}
                  </p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 stroke-[1.75]" />
            </Link>
          );
        })}

        <div className="grid gap-2 pt-1 text-sm text-slate-200">
          {[
            "Read-only access in V1",
            "Manual values before activation",
            "No background monitoring or AI cost",
          ].map((item) => (
            <p key={item} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#ff4d4d] stroke-[1.75]" />
              {item}
            </p>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export async function ControlCenterDashboard() {
  const [activity, messagesLast24Hours] = await Promise.all([
    getEntryOperationalActivity(6),
    getEntryPublishedMessagesLast24Hours(),
  ]);

  const activeProducts = productModules.filter(
    (product) => product.availability === "available",
  );
  const operationalProducts = productModules.filter(
    (product) => product.status === "operational",
  );
  const needsAttention = productModules.filter(
    (product) => product.status === "development" || product.status === "error",
  );
  const eventCount = activity.state === "live" ? activity.items.length : 0;

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-4 px-0.5 pt-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-normal text-white lg:text-[2rem]">
            Minerva Control Center
          </h1>
          <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
            The web home for Minerva products, operations and intelligence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionLink href="/products/add" emphasis>
            <Plus className="h-4 w-4 text-[#ff4d4d] stroke-[1.75]" />
            Add Product
          </ActionLink>
          <ActionLink href="/products/add">
            <Download className="h-4 w-4 stroke-[1.75]" />
            Download Connector Instructions
          </ActionLink>
          <ActionLink href="/brain">
            <BrainCircuit className="h-4 w-4 stroke-[1.75]" />
            Open Brain
          </ActionLink>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={PackagePlus}
          label="Products connected"
          note={`${activeProducts.length} active native module`}
          value={activeProducts.length}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Operational"
          note="Running through existing Console routes"
          value={operationalProducts.length}
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Needs attention"
          note="Future module or setup action"
          value={needsAttention.length}
          warning
        />
        <SummaryCard
          icon={Radio}
          label="Events available"
          note={
            messagesLast24Hours === null
              ? "ENTRY message count unavailable"
              : `${messagesLast24Hours} ENTRY messages in 24h`
          }
          value={eventCount}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="space-y-3">
          <Panel className="overflow-hidden">
            <SectionHeader
              action={
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white"
                >
                  View all products
                  <ArrowRight className="h-4 w-4 stroke-[1.75]" />
                </Link>
              }
              description="Connected Minerva products and reserved module spaces."
              title="Products"
            />
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              {productModules.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
              <AddProductCard />
            </div>
          </Panel>

          <RecentActivityPanel activity={activity} />
        </div>

        <div className="space-y-3">
          <BrainOverviewPanel />
          <NewProductSetupPanel />
        </div>
      </section>
    </div>
  );
}
