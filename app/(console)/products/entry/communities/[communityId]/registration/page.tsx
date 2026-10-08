import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Rubik } from "next/font/google";
import { notFound } from "next/navigation";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";
import { PatronatoReviewControls } from "@/features/entry/communityRegistration/patronato/PatronatoReviewControls";
import { ReviewWorkspace } from "@/features/entry/communityRegistration/review/ReviewWorkspace";
import { getCommunityRegistrationContactHistory, getCommunityRegistrationLatestContactStatuses } from "@/features/entry/communityRegistration/review/contactQueries";
import { getCommunityRegistrationDuplicateReviewData } from "@/features/entry/communityRegistration/review/duplicateQueries";
import { getCommunityRegistrationQuickEditData } from "@/features/entry/communityRegistration/review/quickEditQueries";
import {
  getCommunityRegistrationReviewOverview,
  getCommunityRegistrationReviewUnit,
} from "@/features/entry/communityRegistration/review/queries";
import { getCommunityRegistrationUnitReference } from "@/features/entry/communityRegistration/review/unitReferenceQuery";
import { cn } from "@/lib/supabase/utils";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type RegistrationReviewPageProps = {
  params: Promise<{ communityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function BackToCommunity({ communityId }: { communityId: string }) {
  return (
    <Link
      href={`/products/entry/communities/${communityId}`}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-4 text-sm font-semibold text-white shadow-[0_2px_0_#141119] outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF]"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to community
    </Link>
  );
}

export default async function RegistrationReviewPage(
  props: RegistrationReviewPageProps,
) {
  const [{ communityId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const [community, overview] = await Promise.all([
    getCommunityWithProgress(communityId),
    getCommunityRegistrationReviewOverview(communityId),
  ]);

  if (!community) notFound();

  const requestedUnitId = singleParam(searchParams.unit).trim();

  if (!overview) {
    return (
      <div
        className={cn(
          rubik.className,
          "-mx-4 -my-4 min-h-[calc(100vh-4rem)] bg-[#2E2936] px-4 py-5 text-[#E7E5EA] lg:-mx-6 lg:-my-5 lg:px-6 2xl:-mx-7 2xl:px-7",
        )}
      >
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
              ENTRY REGISTRATION
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
              Resident Registration Review
            </h1>
            <p className="mt-2 text-sm font-semibold text-white">{community.name}</p>
            <p className="mt-1.5 text-sm text-[#A9A3B2]">
              Review household submissions before Patronato confirmation and activation handoff.
            </p>
          </div>
          <BackToCommunity communityId={community.id} />
        </header>

        <section className="mt-4 rounded-[10px] border border-[#141119] bg-[#24202B] p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
            Registration status
          </p>
          <h2 className="mt-3 text-lg font-semibold text-white">
            No registration campaign to review
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A9A3B2]">
            Start a Resident Registration campaign from the community page before opening the internal review workflow.
          </p>
        </section>
      </div>
    );
  }

  const [duplicateData, contactStatuses] = await Promise.all([
    getCommunityRegistrationDuplicateReviewData(
      overview.campaign.id,
      community.id,
    ),
    getCommunityRegistrationLatestContactStatuses(
      overview.campaign.id,
      community.id,
    ),
  ]);
  const unitSummaryById = new Map(overview.units.map((unit) => [unit.id, unit]));

  for (const unit of duplicateData.units) {
    if (unitSummaryById.has(unit.id)) continue;
    unitSummaryById.set(unit.id, {
      hasPendingObservation: false,
      id: unit.id,
      label: unit.label,
      patronatoConfirmedAt: unit.patronatoConfirmedAt,
      residentCount: unit.residents.length,
      reviewedAt: unit.reviewedAt,
      status: unit.status,
      submittedAt: unit.submittedAt,
    });
  }

  const reviewUnits = Array.from(unitSummaryById.values());
  const selectedUnitSummary = requestedUnitId
    ? reviewUnits.find((unit) => unit.id === requestedUnitId) ?? null
    : null;
  const selectedUnitId =
    selectedUnitSummary &&
    selectedUnitSummary.status !== "unregistered" &&
    selectedUnitSummary.residentCount > 0
      ? selectedUnitSummary.id
      : null;
  const [selectedUnit, quickEditData, selectedUnitReference, selectedContactHistory] =
    await Promise.all([
      selectedUnitId
        ? getCommunityRegistrationReviewUnit(overview.campaign.id, selectedUnitId)
        : Promise.resolve(null),
      selectedUnitId
        ? getCommunityRegistrationQuickEditData(selectedUnitId)
        : Promise.resolve(null),
      selectedUnitId
        ? getCommunityRegistrationUnitReference(selectedUnitId)
        : Promise.resolve(null),
      selectedUnitId
        ? getCommunityRegistrationContactHistory(selectedUnitId)
        : Promise.resolve([]),
    ]);

  return (
    <div
      className={cn(
        rubik.className,
        "-mx-4 -my-4 min-h-[calc(100vh-4rem)] bg-[#2E2936] px-4 py-5 text-[#E7E5EA] lg:-mx-6 lg:-my-5 lg:px-6 2xl:-mx-7 2xl:px-7",
      )}
    >
      <div className="space-y-3">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
              ENTRY REGISTRATION
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
              Resident Registration Review
            </h1>
            <p className="mt-2 text-sm font-semibold text-white">{community.name}</p>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#A9A3B2]">
              Review household submissions, resolve exceptions, prepare Patronato approval, and hand approved residents to Activation Queue.
            </p>
          </div>

          <BackToCommunity communityId={community.id} />
        </header>

        <PatronatoReviewControls
          campaignId={overview.campaign.id}
          campaignStatus={overview.campaign.status}
          communityId={community.id}
          confirmedCount={overview.summary.confirmed}
          processedCount={overview.summary.processed}
          reviewedCount={overview.summary.reviewed}
        />

        <ReviewWorkspace
          campaign={overview.campaign}
          communityId={community.id}
          communityName={community.name}
          contactStatuses={contactStatuses}
          duplicateData={duplicateData}
          loadError={overview.loadError}
          quickEditData={quickEditData}
          selectedUnit={selectedUnit}
          selectedUnitId={selectedUnitId}
          selectedUnitReference={selectedUnitReference}
          selectedContactHistory={selectedContactHistory}
          summary={overview.summary}
          units={reviewUnits}
        />
      </div>
    </div>
  );
}
