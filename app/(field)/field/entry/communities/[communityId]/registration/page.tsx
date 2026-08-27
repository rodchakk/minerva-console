import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";
import { getFieldRegistrationProgressState } from "@/features/entry/field/registrationProgressData";
import { FieldRegistrationProgressList } from "@/features/entry/field/FieldRegistrationProgressList";
import {
  getRegistrationProgressCounts,
} from "@/features/entry/field/registrationProgressStatus";
import { formatFieldCount } from "@/features/entry/field/formatting";

type FieldRegistrationProgressPageProps = {
  params: Promise<{ communityId: string }>;
};

function campaignStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "open") return "Open";
  if (normalized === "paused") return "Paused";
  if (normalized === "review") return "In review";
  if (normalized === "confirmed") return "Confirmed";
  if (normalized === "processed") return "Processed";
  if (normalized === "closed") return "Closed";
  return status || "Campaign";
}

function campaignStatusToneClass(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "open") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  }
  if (normalized === "paused") {
    return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }
  if (normalized === "review" || normalized === "confirmed") {
    return "border-sky-300/30 bg-sky-300/10 text-sky-100";
  }
  return "border-white/12 bg-white/[0.03] text-[var(--console-text-muted)]";
}

export default async function FieldRegistrationProgressPage({
  params,
}: FieldRegistrationProgressPageProps) {
  const { communityId } = await params;
  const [community, progressState] = await Promise.all([
    getCommunityWithProgress(communityId),
    getFieldRegistrationProgressState(communityId),
  ]);

  if (!community) {
    notFound();
  }

  const overviewHref = `/field/entry/communities/${encodeURIComponent(community.id)}`;

  if (progressState.state === "unavailable") {
    return (
      <div className="space-y-5">
        <Link
          href={overviewHref}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to community overview
        </Link>

        <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
            Resident registration
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--console-text)]">
            Resident registration progress unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--console-text-muted)]">
            We could not load registration progress right now.
          </p>
        </section>
      </div>
    );
  }

  if (!progressState.campaign) {
    return (
      <div className="space-y-5">
        <Link
          href={overviewHref}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to community overview
        </Link>

        <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
            Resident registration
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--console-text)]">
            No registration campaign
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--console-text-muted)]">
            There is no resident registration campaign to show for {community.name}.
          </p>
        </section>
      </div>
    );
  }

  const counts = getRegistrationProgressCounts(progressState.units);

  return (
    <div className="space-y-5">
      <Link
        href={overviewHref}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to community overview
      </Link>

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              "rounded-full border px-2.5 py-1 text-xs font-bold",
              campaignStatusToneClass(progressState.campaign.status),
            ].join(" ")}
          >
            {campaignStatusLabel(progressState.campaign.status)}
          </span>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          Resident registration
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-9 text-[var(--console-text)]">
          {progressState.campaign.publicTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
          Unit progress for {community.name}.
        </p>
      </section>

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          Aggregate progress
        </p>
        <div className="mt-3 space-y-3 text-sm text-[var(--console-text-muted)]">
          <div className="flex items-baseline justify-between gap-4">
            <span>Submitted</span>
            <strong className="text-lg text-[var(--console-text)]">
              {formatFieldCount(counts.submitted)} / {formatFieldCount(counts.total)}
            </strong>
          </div>
          {counts.notRegistered > 0 ? (
            <div className="flex items-baseline justify-between gap-4">
              <span>Not yet submitted</span>
              <strong className="text-base text-[var(--console-text)]">
                {formatFieldCount(counts.notRegistered)}
              </strong>
            </div>
          ) : null}
          {counts.needsAttention > 0 ? (
            <div className="flex items-baseline justify-between gap-4">
              <span>Needs attention</span>
              <strong className="text-base text-amber-100">
                {formatFieldCount(counts.needsAttention)}
              </strong>
            </div>
          ) : null}
        </div>
      </section>

      <FieldRegistrationProgressList units={progressState.units} />
    </div>
  );
}
