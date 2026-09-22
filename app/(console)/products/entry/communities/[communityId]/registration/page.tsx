import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";
import { ReviewWorkspace } from "@/features/entry/communityRegistration/review/ReviewWorkspace";
import { getCommunityRegistrationQuickEditData } from "@/features/entry/communityRegistration/review/quickEditQueries";
import { getCommunityRegistrationDuplicateReviewData } from "@/features/entry/communityRegistration/review/duplicateQueries";
import {
  getCommunityRegistrationReviewOverview,
  getCommunityRegistrationReviewUnit,
} from "@/features/entry/communityRegistration/review/queries";
import { getCommunityRegistrationUnitReference } from "@/features/entry/communityRegistration/review/unitReferenceQuery";

type RegistrationReviewPageProps = {
  params: Promise<{ communityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
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
      <div className="space-y-4">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5 lg:px-6">
          <PageHeader
            title={`Resident registration · ${community.name}`}
            description="Internal review workspace"
            actions={
              <Link href={`/products/entry/communities/${community.id}`}>
                <Button variant="secondary">Back to community</Button>
              </Link>
            }
          />
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <Badge tone="default">Not started</Badge>
          <h2 className="mt-4 text-xl font-semibold text-white">
            No registration campaign to review
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Start a Resident registration campaign from the community page before
            opening the internal review workflow.
          </p>
        </section>
      </div>
    );
  }

  const duplicateData = await getCommunityRegistrationDuplicateReviewData(
    overview.campaign.id,
    community.id,
  );
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
  const [selectedUnit, quickEditData, selectedUnitReference] = await Promise.all([
    selectedUnitId
      ? getCommunityRegistrationReviewUnit(overview.campaign.id, selectedUnitId)
      : Promise.resolve(null),
    selectedUnitId
      ? getCommunityRegistrationQuickEditData(selectedUnitId)
      : Promise.resolve(null),
    selectedUnitId
      ? getCommunityRegistrationUnitReference(selectedUnitId)
      : Promise.resolve(null),
  ]);

  return (
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-[2200px] -translate-x-1/2 space-y-3 lg:w-[calc(100vw-19rem)] 2xl:w-[calc(100vw-19.5rem)]">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5 lg:px-6">
        <PageHeader
          title={`Resident registration · ${community.name}`}
          description="Review household submissions before Patronato confirmation."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href={`/products/entry/communities/${community.id}`}>
                <Button variant="secondary">Back to community</Button>
              </Link>
            </div>
          }
        />
      </section>

      <ReviewWorkspace
        campaign={overview.campaign}
        communityId={community.id}
        duplicateData={duplicateData}
        loadError={overview.loadError}
        quickEditData={quickEditData}
        selectedUnit={selectedUnit}
        selectedUnitId={selectedUnitId}
        selectedUnitReference={selectedUnitReference}
        summary={overview.summary}
        units={reviewUnits}
      />
    </div>
  );
}
