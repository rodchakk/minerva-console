import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Download,
  FileText,
  Lock,
  LucideIcon,
  MessageSquare,
  PackagePlus,
  Plus,
  Radio,
  Settings2,
  TicketCheck,
  UserCheck,
  UserPlus,
} from "lucide-react";
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
        "rounded-lg border border-white/[0.10] bg-[#10151b] shadow-[0_20px_55px_rgba(0,0,0,0.22)]",
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
          ? "border-[#ff4d4d]/35 bg-white/[0.045] text-white hover:border-[#ff4d4d]/50 hover:bg-white/[0.07]"
          : "border-white/[0.10] bg-white/[0.025] text-slate-200 hover:border-[#ff4d4d]/30 hover:bg-white/[0.045]",
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
  accent,
  icon: Icon,
  label,
  note,
  value,
}: {
  accent: "amber" | "blue" | "teal" | "violet";
  icon: LucideIcon;
  label: string;
  note: string;
  value: string | number;
}) {
  const accentClassNames = {
    amber: {
      glow: "bg-amber-400/10 text-amber-300 shadow-[0_0_34px_rgba(245,158,11,0.22)]",
      ring: "border-amber-300/30",
      dot: "bg-amber-300",
      wash: "from-amber-400/[0.10]",
    },
    blue: {
      glow: "bg-sky-400/10 text-sky-300 shadow-[0_0_34px_rgba(56,189,248,0.20)]",
      ring: "border-sky-300/30",
      dot: "bg-sky-300",
      wash: "from-sky-400/[0.09]",
    },
    teal: {
      glow: "bg-teal-400/10 text-teal-300 shadow-[0_0_34px_rgba(45,212,191,0.20)]",
      ring: "border-teal-300/30",
      dot: "bg-teal-300",
      wash: "from-teal-400/[0.10]",
    },
    violet: {
      glow: "bg-violet-400/10 text-violet-300 shadow-[0_0_34px_rgba(167,139,250,0.20)]",
      ring: "border-violet-300/30",
      dot: "bg-violet-300",
      wash: "from-violet-400/[0.10]",
    },
  }[accent];

  return (
    <Panel
      className={cn(
        "relative min-h-[126px] overflow-hidden p-5",
        "bg-linear-to-br to-transparent",
        accentClassNames.wash,
      )}
    >
      <div className="flex h-full items-center gap-4">
        <span
          className={cn(
            "inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full border",
            accentClassNames.ring,
            accentClassNames.glow,
          )}
        >
          <Icon className="h-7 w-7 stroke-[1.75]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-300">{label}</p>
          <p className="mt-1 text-[2rem] font-semibold leading-9 text-white">{value}</p>
          <p className="mt-1.5 flex items-center gap-2 text-xs text-[var(--console-text-muted)]">
            <span className={cn("h-1.5 w-1.5 rounded-full", accentClassNames.dot)} />
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
  const accent =
    product.status === "operational"
      ? {
          border: "border-t-violet-400/80",
          icon: "border-violet-300/25 bg-violet-400/10 text-violet-300",
          status: "border-teal-300/20 bg-teal-400/10 text-teal-200",
        }
      : {
          border: "border-t-sky-300/80",
          icon: "border-sky-300/20 bg-sky-400/10 text-sky-300",
          status: "border-amber-300/20 bg-amber-400/10 text-amber-100",
        };

  return (
    <article
      className={cn(
        "flex min-h-[256px] flex-col rounded-lg border border-t-4 border-white/[0.10] bg-white/[0.025] p-5",
        accent.border,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border",
              accent.icon,
            )}
          >
            <Icon className="h-5 w-5 stroke-[1.75]" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">{product.name}</h3>
            <p className="mt-0.5 text-xs capitalize text-[var(--console-text-muted)]">
              {product.kind} product
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
            accent.status,
          )}
        >
          <StatusDot status={product.status} />
          {product.statusLabel}
        </span>
      </div>

      <p className="mt-3 min-h-[40px] text-sm leading-5 text-[var(--console-text-muted)]">
        {product.description}
      </p>

      <div className="mt-4 grid grid-cols-3 divide-x divide-white/[0.10] border-y border-white/[0.08] py-3">
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
      className="flex min-h-[256px] flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.18] bg-white/[0.012] p-5 text-center transition-colors hover:border-[#ff4d4d]/35 hover:bg-white/[0.03]"
    >
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-slate-100">
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

const activityAccentBySeverity = {
  error: {
    badge: "border-rose-300/20 bg-rose-400/10 text-rose-200",
    icon: "bg-rose-400/10 text-rose-300",
  },
  info: {
    badge: "border-violet-300/20 bg-violet-400/10 text-violet-200",
    icon: "bg-sky-400/10 text-sky-300",
  },
  warning: {
    badge: "border-amber-300/20 bg-amber-400/10 text-amber-100",
    icon: "bg-amber-400/10 text-amber-300",
  },
};

function getActivityIcon(item: Awaited<ReturnType<typeof getEntryOperationalActivity>>["items"][number]) {
  if (item.eventKey.includes("message")) {
    return MessageSquare;
  }

  if (item.eventKey.includes("ticket")) {
    return TicketCheck;
  }

  if (item.eventKey.includes("user") || item.eventKey.includes("resident")) {
    return UserCheck;
  }

  if (item.eventKey.includes("settings")) {
    return Settings2;
  }

  return FileText;
}

function formatRelativeActivityTime(value: string) {
  const occurredAt = new Date(value).getTime();

  if (!Number.isFinite(occurredAt)) {
    return "Recently";
  }

  const minutesAgo = Math.max(0, Math.round((Date.now() - occurredAt) / 60000));

  if (minutesAgo < 1) {
    return "Now";
  }

  if (minutesAgo < 60) {
    return `${minutesAgo}m ago`;
  }

  const hoursAgo = Math.round(minutesAgo / 60);
  return `${hoursAgo}h ago`;
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
      <div className="overflow-x-auto px-4 pb-4">
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
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[minmax(280px,1fr)_minmax(220px,0.85fr)_110px_86px] border-b border-white/[0.10] px-2 py-2 text-xs font-medium text-[var(--console-text-muted)]">
              <span>Event</span>
              <span>Details</span>
              <span>Source</span>
              <span>Time</span>
            </div>
            <div className="divide-y divide-white/[0.08]">
              {items.map((item) => {
                const Icon = getActivityIcon(item);
                const accent = activityAccentBySeverity[item.severity];

                return (
                  <div
                    key={item.eventId}
                    className="grid grid-cols-[minmax(280px,1fr)_minmax(220px,0.85fr)_110px_86px] items-center gap-4 px-2 py-2.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          accent.icon,
                        )}
                      >
                        <Icon className="h-4 w-4 stroke-[1.75]" />
                      </span>
                      <p className="min-w-0 truncate font-medium text-slate-100">
                        {item.eventLabel}: {item.communityName}
                      </p>
                    </div>
                    <p className="truncate text-[var(--console-text-muted)]">{item.detail}</p>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-md border px-2 py-1 text-[11px] font-semibold",
                        accent.badge,
                      )}
                    >
                      ENTRY
                    </span>
                    <span className="text-xs text-[var(--console-text-muted)]">
                      {formatRelativeActivityTime(item.occurredAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
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
          const isConnector = action.label === "MINERVA_CONNECTOR.md";

          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex min-h-20 items-center justify-between gap-4 rounded-md border border-white/[0.10] bg-white/[0.025] px-3 py-3 transition-colors hover:border-[#ff4d4d]/30 hover:bg-white/[0.04]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                    isConnector
                      ? "border-[#ff4d4d]/25 bg-[#ff4d4d]/10 text-[#ff6b6b]"
                      : "border-violet-300/25 bg-violet-400/10 text-violet-300",
                  )}
                >
                  <Icon className="h-5 w-5 stroke-[1.75]" />
                </span>
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
              <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-300 stroke-[1.75]" />
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

  const dashboardProducts = productModules.filter((product) => product.id === "entry");
  const activeProducts = dashboardProducts.filter(
    (product) => product.availability === "available",
  );
  const operationalProducts = dashboardProducts.filter(
    (product) => product.status === "operational",
  );
  const needsAttention = dashboardProducts.filter(
    (product) => product.status === "disconnected" || product.status === "error",
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
          <Link
            href="/users?invite=1"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#ff4d4d]/35 bg-white/[0.045] px-3.5 text-sm font-semibold text-white transition-colors hover:border-[#ff4d4d]/50 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff4d4d]/40"
          >
            <UserPlus className="h-4 w-4 stroke-[1.75]" />
            Add User
          </Link>
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
          accent="violet"
          icon={PackagePlus}
          label="Products connected"
          note={`${activeProducts.length} active native module`}
          value={activeProducts.length}
        />
        <SummaryCard
          accent="teal"
          icon={CheckCircle2}
          label="Operational"
          note="Running through existing Console routes"
          value={operationalProducts.length}
        />
        <SummaryCard
          accent="amber"
          icon={AlertTriangle}
          label="Needs attention"
          note="Future module or setup action"
          value={needsAttention.length}
        />
        <SummaryCard
          accent="blue"
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

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
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
              {dashboardProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
              <AddProductCard />
            </div>
          </Panel>

          <RecentActivityPanel activity={activity} />
        </div>

        <div>
          <NewProductSetupPanel />
        </div>
      </section>
    </div>
  );
}
