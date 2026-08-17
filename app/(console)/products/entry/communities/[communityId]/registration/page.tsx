import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";
import { ReviewWorkspace } from "@/features/entry/communityRegistration/review/ReviewWorkspace";
import {
  getCommunityRegistrationReviewOverview,
  getCommunityRegistrationReviewUnit,
} from "@/features/entry/communityRegistration/review/queries";

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
  const selectedUnit = selectedUnitId
    ? await getCommunityRegistrationReviewUnit(overview.campaign.id, selectedUnitId)
    : null;

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

      <ReviewWorkspace
        campaign={overview.campaign}
        communityId={community.id}
        loadError={overview.loadError}
        selectedUnit={selectedUnit}
        selectedUnitId={selectedUnitId}
        summary={overview.summary}
        units={overview.units}
      />
    </div>
  );
}
