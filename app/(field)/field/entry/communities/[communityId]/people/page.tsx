import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isEntryPreviewReadOnly } from "@/features/entry/deploymentBoundary";
import { FieldPeopleOverview } from "@/features/entry/field/FieldPeopleOverview";
import { getFieldPeoplePageData } from "@/features/entry/field/peopleData";

type FieldPeoplePageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function FieldPeoplePage({ params }: FieldPeoplePageProps) {
  const { communityId } = await params;
  const data = await getFieldPeoplePageData(communityId);

  if (!data.community) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/field/entry/communities/${encodeURIComponent(communityId)}`}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Community overview
      </Link>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          People and units
        </p>
        <h1 className="break-words text-3xl font-semibold leading-9 text-[var(--console-text)]">
          {data.community.name}
        </h1>
        <p className="text-sm leading-6 text-[var(--console-text-muted)]">
          Find residents, admins, guards, units, and activation rows for onsite
          ENTRY support.
        </p>
        {isEntryPreviewReadOnly() ? (
          <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
            Preview is read-only. Read screens work, but mutation confirmations
            are disabled.
          </p>
        ) : null}
      </section>

      <FieldPeopleOverview
        activationRows={data.activation.items}
        activationState={data.activation.state}
        communityId={data.community.id}
        residentState={data.residents.state}
        residents={data.residents.items}
        unitState={data.units.state}
        units={data.units.items}
      />
    </div>
  );
}
