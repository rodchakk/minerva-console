import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { addCommunityUnitsAction } from "@/features/entry/communities/actions";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";

type UnitsNewSearchParams = {
  error?: string;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "empty":
      return "Paste at least one unit before importing.";
    case "import_failed":
      return "The unit import failed. Review the list and try again.";
    default:
      return null;
  }
}

export default async function NewCommunityUnitsPage(
  props: PageProps<"/products/entry/communities/[communityId]/units/new">,
) {
  const { communityId } = await props.params;
  const searchParams = (await props.searchParams) as UnitsNewSearchParams;
  const community = await getCommunityWithProgress(communityId);

  if (!community) {
    notFound();
  }

  const errorMessage = getErrorMessage(searchParams.error);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Create units"
        description={`Add houses, apartments, or ${community.unitLabel.toLowerCase()} for ${community.name}.`}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={`/products/entry/communities/${community.id}`}>
              <Button variant="secondary">Back to community</Button>
            </Link>
            <Link href={`/products/entry/communities/${community.id}/units`}>
              <Button variant="secondary">View unit directory</Button>
            </Link>
          </div>
        }
      />

      <section className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(112,104,255,0.16),rgba(17,24,39,0.92))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.28)] xl:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">Onboarding task</Badge>
              <Badge tone={community.isActive ? "success" : "default"}>
                {community.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge tone="info">{community.unitLabel}</Badge>
            </div>
            <h2 className="mt-5 text-3xl font-semibold text-white">
              Add the first unit records
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Paste one unit per line. These records unlock resident assignment,
              access history by unit, and the final onboarding readiness gate.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[rgba(9,12,24,0.5)] px-5 py-4 xl:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
              Example format
            </p>
            <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-black/20 px-4 py-3 text-sm leading-6 text-slate-200">
{`Casa 1
Casa 2
Casa 3
Apartamento A-101`}
            </pre>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] xl:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
              Units import
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              Simple unit creation
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Duplicates and blank lines are ignored by the import flow.
            </p>
          </div>
          <Badge tone="info">Current units: {community.totalUnits}</Badge>
        </div>

        {errorMessage ? (
          <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <form action={addCommunityUnitsAction} className="mt-6 space-y-5">
          <input type="hidden" name="community_id" value={community.id} />
          <label className="block space-y-3">
            <span className="text-sm font-semibold text-white">Units list</span>
            <textarea
              name="units_input"
              rows={12}
              placeholder={"Casa 1\nCasa 2\nCasa 3"}
              className="w-full rounded-3xl border border-white/10 bg-[var(--surface-strong)] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/50"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="submit">Import units</Button>
            <Link href={`/products/entry/communities/${community.id}`}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
