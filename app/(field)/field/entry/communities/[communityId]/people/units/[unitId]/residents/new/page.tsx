import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isEntryPreviewReadOnly } from "@/features/entry/deploymentBoundary";
import { FieldQuickResidentForm } from "@/features/entry/field/FieldQuickResidentForm";
import { getFieldUnitDetailData } from "@/features/entry/field/peopleData";

type FieldQuickResidentPageProps = {
  params: Promise<{ communityId: string; unitId: string }>;
};

export default async function FieldQuickResidentPage({
  params,
}: FieldQuickResidentPageProps) {
  const { communityId, unitId } = await params;
  const data = await getFieldUnitDetailData(communityId, unitId);

  if (!data.community || data.units.state === "unavailable" || !data.unit) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/field/entry/communities/${encodeURIComponent(communityId)}/people/units/${encodeURIComponent(unitId)}`}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {data.unit.label}
      </Link>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          Quick create
        </p>
        <h1 className="text-3xl font-semibold leading-9 text-[var(--console-text)]">
          Add resident
        </h1>
        <p className="text-sm leading-6 text-[var(--console-text-muted)]">
          Create an ENTRY resident account and link it directly to this unit.
        </p>
      </section>

      <FieldQuickResidentForm
        communityId={data.community.id}
        communityName={data.community.name}
        isReadOnlyPreview={isEntryPreviewReadOnly()}
        unitId={data.unit.id}
        unitLabel={data.unit.label}
      />
    </div>
  );
}
