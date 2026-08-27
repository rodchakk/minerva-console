import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";
import { getCommunityRegistrationAdminState } from "@/features/entry/communityRegistration/admin/queries";
import { isEntryPreviewReadOnly } from "@/features/entry/deploymentBoundary";
import { FieldRegistrationLaunchFlow } from "@/features/entry/field/FieldRegistrationLaunchFlow";
import { isRegistrationLaunchEligible } from "@/features/entry/field/registrationState";

type FieldRegistrationStartPageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function FieldRegistrationStartPage({
  params,
}: FieldRegistrationStartPageProps) {
  const { communityId } = await params;
  const [community, registrationState] = await Promise.all([
    getCommunityWithProgress(communityId),
    getCommunityRegistrationAdminState(communityId),
  ]);

  if (!community) {
    notFound();
  }

  const isReadOnlyPreview = isEntryPreviewReadOnly();
  const canLaunch = isRegistrationLaunchEligible({
    hasOperationalCampaign: registrationState.hasOperationalCampaign,
    isReadOnlyPreview,
    unitCount: registrationState.units.length,
  });

  if (!canLaunch) {
    return (
      <div className="space-y-5">
        <Link
          href={`/field/entry/communities/${encodeURIComponent(communityId)}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to community overview
        </Link>

        <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5">
          <h1 className="text-2xl font-semibold text-[var(--console-text)]">
            Registration campaign launch unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--console-text-muted)]">
            {registrationState.hasOperationalCampaign
              ? "An operational registration campaign already exists for this community."
              : registrationState.units.length === 0
              ? "Unit records are required before starting a registration campaign."
              : "Registration campaign creation is unavailable in read-only Preview mode."}
          </p>
        </section>
      </div>
    );
  }

  return (
    <FieldRegistrationLaunchFlow
      communityId={community.id}
      communityName={community.name}
      isReadOnlyPreview={isReadOnlyPreview}
      units={registrationState.units}
    />
  );
}
