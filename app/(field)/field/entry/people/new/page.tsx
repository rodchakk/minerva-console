import Link from "next/link";
import { ArrowLeft, ArrowRight, MapPinHouse } from "lucide-react";
import { getCommunitiesWithProgressResult } from "@/features/entry/communities/queries";

export default async function FieldAddUserPage() {
  const communitiesResult = await getCommunitiesWithProgressResult();
  const activeCommunities =
    communitiesResult.state === "ready"
      ? communitiesResult.items.filter((community) => community.isActive)
      : [];

  return (
    <div className="space-y-5">
      <Link
        href="/field/entry/people"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        People
      </Link>

      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          ENTRY Field
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--console-text)]">
          Add user
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
          Choose the community first. Field will reuse the existing resident or guard creation flow.
        </p>
      </section>

      {communitiesResult.state === "unavailable" ? (
        <section className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          Community list unavailable. Try again before creating a user.
        </section>
      ) : activeCommunities.length === 0 ? (
        <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 text-sm leading-6 text-[var(--console-text-muted)]">
          No active communities are available for user creation.
        </section>
      ) : (
        <section className="space-y-2.5" aria-label="Choose community">
          {activeCommunities.map((community) => (
            <Link
              key={community.id}
              href={`/field/entry/communities/${encodeURIComponent(community.id)}/people/new`}
              className="group flex min-h-20 items-center gap-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 transition-colors hover:border-[var(--console-accent-border)] hover:bg-[var(--console-surface-hover)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--console-accent-subtle)] text-[var(--console-accent)]">
                <MapPinHouse aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-base font-semibold text-[var(--console-text)]">
                  {community.name}
                </span>
                <span className="mt-1 block text-sm text-[var(--console-text-muted)]">
                  {community.totalUnits} units · {community.totalMembers} members
                </span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-[var(--console-text-soft)] transition-colors group-hover:text-[var(--console-text)]"
              />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
