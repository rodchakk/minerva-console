import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Shield, UserRound } from "lucide-react";
import { getFieldPeoplePageData } from "@/features/entry/field/peopleData";

type FieldCreateUserPageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function FieldCreateUserPage({
  params,
}: FieldCreateUserPageProps) {
  const { communityId } = await params;
  const data = await getFieldPeoplePageData(communityId);

  if (!data.community) {
    notFound();
  }

  const activeUnits =
    data.units.state === "ready"
      ? data.units.items.filter((unit) => unit.isActive)
      : [];

  return (
    <div className="space-y-5">
      <Link
        href={`/field/entry/communities/${encodeURIComponent(communityId)}/people`}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        People
      </Link>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          People
        </p>
        <h1 className="text-3xl font-semibold leading-9 text-[var(--console-text)]">
          Create user
        </h1>
        <p className="text-sm leading-6 text-[var(--console-text-muted)]">
          Create an ENTRY account for {data.community.name}. Choose the account
          type and Field will use the existing secure setup flow.
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-start gap-3">
          <UserRound
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--console-accent)]"
          />
          <div>
            <h2 className="text-lg font-semibold text-[var(--console-text)]">
              Resident
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
              Resident accounts must belong to a unit. Select the unit first.
            </p>
          </div>
        </div>

        {data.units.state === "unavailable" ? (
          <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
            Units are unavailable right now. Resident creation is temporarily
            unavailable.
          </p>
        ) : activeUnits.length === 0 ? (
          <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--console-text-muted)]">
            No active units are available for resident creation.
          </p>
        ) : (
          <div className="space-y-2">
            {activeUnits.map((unit) => (
              <Link
                key={unit.id}
                href={`/field/entry/communities/${encodeURIComponent(communityId)}/people/units/${encodeURIComponent(unit.id)}/residents/new`}
                className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-[var(--console-border)] bg-white/[0.025] px-4 py-3 transition-colors hover:bg-white/[0.05]"
              >
                <span>
                  <span className="block text-sm font-semibold text-[var(--console-text)]">
                    {unit.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--console-text-soft)]">
                    Create resident in this unit
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-[var(--console-text-soft)]"
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-start gap-3">
          <Shield
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--console-accent)]"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[var(--console-text)]">
              Guard
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
              Create a guard account for this community without a unit
              assignment.
            </p>
          </div>
        </div>
        <Link
          href={`/field/entry/access/guards/new?communityId=${encodeURIComponent(communityId)}`}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/[0.08]"
        >
          Create guard
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </section>

      <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.02] p-3 text-xs leading-5 text-[var(--console-text-soft)]">
        Community admin access is assigned to an existing ENTRY user from
        Access. Field does not create protected Minerva/system-owner accounts.
      </p>
    </div>
  );
}
