import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isEntryPreviewReadOnly } from "@/features/entry/deploymentBoundary";
import { FieldResidentActions } from "@/features/entry/field/FieldResidentActions";
import { getFieldResidentDetailData } from "@/features/entry/field/peopleData";

type FieldResidentDetailPageProps = {
  params: Promise<{ communityId: string; userId: string }>;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
        {label}
      </p>
      <p className="mt-1 break-words text-base text-[var(--console-text)]">
        {value || "Not available"}
      </p>
    </div>
  );
}

export default async function FieldResidentDetailPage({
  params,
}: FieldResidentDetailPageProps) {
  const { communityId, userId } = await params;
  const data = await getFieldResidentDetailData(communityId, userId);

  if (!data.community) {
    notFound();
  }

  if (data.residents.state === "unavailable") {
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
          Resident detail unavailable{data.residents.error ? `: ${data.residents.error}` : "."}
        </section>
      </div>
    );
  }

  if (!data.resident) {
    notFound();
  }

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
          Resident
        </p>
        <h1 className="break-words text-3xl font-semibold leading-9 text-[var(--console-text)]">
          {data.resident.fullName}
        </h1>
      </section>

      <section className="grid gap-3">
        <DetailRow label="Current unit" value={data.resident.houseLabel} />
        <DetailRow label="Login identity" value={data.resident.identity} />
        <DetailRow label="Phone" value={data.resident.phone} />
        <DetailRow label="Account state" value={data.resident.accountState} />
      </section>

      <FieldResidentActions
        communityId={data.community.id}
        isReadOnlyPreview={isEntryPreviewReadOnly()}
        resident={data.resident}
        units={data.units.state === "ready" ? data.units.items : []}
      />
    </div>
  );
}
