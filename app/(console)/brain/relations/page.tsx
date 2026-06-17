import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { BrainEyebrow } from "@/features/brain/components/BrainEyebrow";
import { RelationsPanel } from "@/features/brain/components/RelationsPanel";
import {
  getBrainRelationIndex,
  getBrokenBrainRelations,
} from "@/features/brain/lib/relations";

export default async function BrainRelationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const focus = typeof params.focus === "string" ? params.focus : "";

  const index = getBrainRelationIndex();
  const broken = getBrokenBrainRelations();

  // Entries with at least one outgoing or incoming relation, or a broken ref.
  const connected = index.filter(
    (group) =>
      group.outgoing.length > 0 ||
      group.incoming.length > 0 ||
      group.brokenOutgoing.length > 0,
  );

  const focusGroups = focus
    ? index.filter((group) => group.entry.id === focus)
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Brain Relations"
        description="Derived relation map across Brain registries. Outgoing references are explicit; incoming backlinks are derived. Git-backed and read-only."
        eyebrow={<BrainEyebrow />}
      />

      {broken.length > 0 && (
        <div className="rounded-[28px] border border-rose-400/20 bg-rose-500/8 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">
            Broken relations ({broken.length})
          </p>
          <p className="mt-1.5 text-sm leading-6 text-rose-100/80">
            These <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">related</code>{" "}
            IDs do not exist in any registry. Fix them before merge.
          </p>
          <ul className="mt-3 space-y-1.5">
            {broken.map((b) => (
              <li key={`${b.sourceKind}-${b.sourceId}-${b.missingId}`} className="text-sm">
                <Link href={b.href} className="font-mono text-xs text-rose-200 hover:text-white">
                  {b.sourceId}
                </Link>
                <span className="text-rose-100/70"> ({b.sourceKind}) references missing </span>
                <span className="font-mono text-xs text-rose-100">{b.missingId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {focus ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/brain/relations"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400 hover:text-sky-300"
            >
              &larr; All relations
            </Link>
            <span className="text-sm text-[var(--text-muted)]">
              Focused on <span className="font-mono text-xs text-white">{focus}</span>
            </span>
          </div>

          {focusGroups.length === 0 ? (
            <EmptyState
              title="No entry found"
              description={`No Brain entry has the ID "${focus}". Check the ID and try again.`}
            />
          ) : (
            focusGroups.map((group) => (
              <div key={`${group.entry.kind}-${group.entry.id}`} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={group.entry.href}
                    className="font-mono text-xs text-[var(--text-muted)] hover:text-sky-400"
                  >
                    {group.entry.id}
                  </Link>
                  <Badge tone="info">{group.entry.kind}</Badge>
                  <span className="text-sm font-medium text-white">
                    {group.entry.title}
                  </span>
                </div>
                <RelationsPanel group={group} />
              </div>
            ))
          )}
        </div>
      ) : connected.length === 0 ? (
        <EmptyState
          title="No relations yet"
          description="Add IDs to the related arrays in content/brain/registries/*.json to connect entries."
        />
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-strong)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <tr>
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Entry</th>
                <th className="px-5 py-3">Kind</th>
                <th className="px-5 py-3 text-center">Outgoing</th>
                <th className="px-5 py-3 text-center">Incoming</th>
                <th className="px-5 py-3 text-center">Broken</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {connected.map((group) => (
                <tr
                  key={`${group.entry.kind}-${group.entry.id}`}
                  className="border-b border-[var(--border)] align-top last:border-b-0"
                >
                  <td className="px-5 py-4 font-mono text-xs text-[var(--text-muted)]">
                    <Link href={group.entry.href} className="hover:text-sky-400">
                      {group.entry.id}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={group.entry.href}
                      className="font-medium text-white hover:text-sky-400"
                    >
                      {group.entry.title}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone="info">{group.entry.kind}</Badge>
                  </td>
                  <td className="px-5 py-4 text-center text-slate-300">
                    {group.outgoing.length}
                  </td>
                  <td className="px-5 py-4 text-center text-slate-300">
                    {group.incoming.length}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {group.brokenOutgoing.length > 0 ? (
                      <Badge tone="danger">{group.brokenOutgoing.length}</Badge>
                    ) : (
                      <span className="text-[var(--text-muted)]">0</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/brain/relations?focus=${encodeURIComponent(group.entry.id)}`}
                      className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400 hover:text-sky-300"
                    >
                      Focus
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
