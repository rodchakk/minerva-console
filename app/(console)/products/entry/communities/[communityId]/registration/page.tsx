import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";
import { ReviewWorkspace } from "@/features/entry/communityRegistration/review/ReviewWorkspace";
import { getCommunityRegistrationQuickEditData } from "@/features/entry/communityRegistration/review/quickEditQueries";
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

  const selectedUnitSummary = requestedUnitId
    ? overview.units.find((unit) => unit.id === requestedUnitId) ?? null
    : null;
  const selectedUnitId =
    selectedUnitSummary &&
    selectedUnitSummary.status !== "unregistered" &&
    selectedUnitSummary.residentCount > 0
      ? selectedUnitSummary.id
      : null;
  const [selectedUnit, quickEditData, selectedUnitReference] = selectedUnitId
    ? await Promise.all([
        getCommunityRegistrationReviewUnit(overview.campaign.id, selectedUnitId),
        getCommunityRegistrationQuickEditData(selectedUnitId),
        getCommunityRegistrationUnitReference(selectedUnitId),
      ])
    : [null, null, null];

  return (
    <div className="space-y-4">
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

      {selectedUnit && selectedUnitReference ? (
        <section className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">
                Referencia de la vivienda
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-base font-semibold text-white">
                  {selectedUnit.unitLabel}
                </p>
                <p className="text-sm leading-6 text-[var(--text-muted)]">
                  {selectedUnitReference}
                </p>
              </div>
            </div>
            <Badge tone="info">Para revisión</Badge>
          </div>
        </section>
      ) : null}

      <ReviewWorkspace
        campaign={overview.campaign}
        communityId={community.id}
        loadError={overview.loadError}
        quickEditData={quickEditData}
        selectedUnit={selectedUnit}
        selectedUnitId={selectedUnitId}
        selectedUnitReference={selectedUnitReference}
        summary={overview.summary}
        units={overview.units}
      />
    </div>
  );
}
