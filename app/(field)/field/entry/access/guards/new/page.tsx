import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCommunitiesWithProgressResult } from "@/features/entry/communities/queries";
import { FieldCreateGuardForm } from "@/features/entry/field/FieldCreateGuardForm";

export default async function FieldCreateGuardPage() {
  const result = await getCommunitiesWithProgressResult();
  const communities = result.items
    .filter((community) => community.isActive)
    .map((community) => ({ id: community.id, name: community.name }));

  return (
    <div className="space-y-4">
      <Link
        href="/field/entry/access"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Access
      </Link>

      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--console-accent)]">
          Access
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--console-text)]">
          Create guard
        </h1>
        <p className="mt-2 text-sm leading-5 text-[var(--console-text-muted)]">
          Create a username-based guard account without assigning a unit.
        </p>
      </section>

      {result.state === "unavailable" ? (
        <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-5 text-amber-100">
          Communities are unavailable right now. Try again before creating a guard.
        </p>
      ) : communities.length === 0 ? (
        <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-5 text-[var(--console-text-muted)]">
          No active communities are available for guard creation.
        </p>
      ) : (
        <section className="rounded-lg border border-[var(--console-border)] bg-white/[0.02] p-4">
          <FieldCreateGuardForm communities={communities} />
        </section>
      )}
    </div>
  );
}
