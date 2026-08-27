import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isEntryPreviewReadOnly } from "@/features/entry/deploymentBoundary";
import { FieldUnitActions } from "@/features/entry/field/FieldUnitActions";
import { getFieldUnitDetailData } from "@/features/entry/field/peopleData";
import { formatFieldUnitResidentCount } from "@/features/entry/field/peopleModel";

type FieldUnitDetailPageProps = {
  params: Promise<{ communityId: string; unitId: string }>;
};

export default async function FieldUnitDetailPage({
  params,
}: FieldUnitDetailPageProps) {
  const { communityId, unitId } = await params;
  const data = await getFieldUnitDetailData(communityId, unitId);

  if (!data.community) {
    notFound();
  }

  if (data.units.state === "unavailable") {
    return (
      <div className="space-y-5">
        <Link
          href={`/field/entry/communities/${encodeURIComponent(communityId)}/people`}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Residents and units
        </Link>
        <section className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          Unit detail unavailable.
        </section>
      </div>
    );
  }

  if (!data.unit) {
    notFound();
  }

  const eligibleResidents =
    data.residents.state === "ready"
      ? data.residents.items.filter((resident) => resident.houseId !== data.unit?.id)
      : [];

  return (
    <div className="space-y-5">
      <Link
        href={`/field/entry/communities/${encodeURIComponent(communityId)}/people`}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Residents and units
      </Link>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          Unit
        </p>
        <h1 className="break-words text-3xl font-semibold leading-9 text-[var(--console-text)]">
          {data.unit.label}
        </h1>
        <p className="text-sm leading-6 text-[var(--console-text-muted)]">
          {formatFieldUnitResidentCount(data.unit)} - {data.unit.isActive ? "Active" : "Inactive"}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--console-text)]">
          Linked residents
        </h2>
        {data.residentsForUnit.state === "unavailable" ? (
          <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
            Linked residents unavailable.
          </p>
        ) : data.residentsForUnit.items.length > 0 ? (
          <div className="space-y-2">
            {data.residentsForUnit.items.map((resident) => (
              <Link
                key={resident.userId}
                href={`/field/entry/communities/${encodeURIComponent(communityId)}/people/residents/${encodeURIComponent(resident.userId)}`}
                className="block rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4"
              >
                <span className="block break-words text-base font-semibold text-[var(--console-text)]">
                  {resident.fullName}
                </span>
                <span className="mt-1 block break-words text-sm text-[var(--console-text-muted)]">
                  {resident.identity} - {resident.accountState}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-4 text-sm leading-6 text-[var(--console-text-muted)]">
            No residents are linked to this unit.
          </p>
        )}
      </section>

      <FieldUnitActions
        communityId={data.community.id}
        eligibleResidents={eligibleResidents}
        isReadOnlyPreview={isEntryPreviewReadOnly()}
        residentState={data.residents.state}
        unit={data.unit}
      />
    </div>
  );
}
