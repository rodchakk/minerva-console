import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type {
  BrainRelationGroup,
  BrainRelationNode,
} from "@/features/brain/lib/relations";

function RelationNodeRow({ node }: { node: BrainRelationNode }) {
  return (
    <Link
      href={node.href}
      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2.5 transition-colors hover:border-white/20 hover:bg-white/8"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="font-mono text-[11px] text-[var(--text-muted)]">
          {node.id}
        </span>
        <span className="truncate text-sm text-white">{node.title}</span>
      </div>
      <Badge tone="info">{node.kind}</Badge>
    </Link>
  );
}

/**
 * Renders a single entry's relations: outgoing references, incoming backlinks,
 * and any broken outgoing references. Shows a calm empty state when an entry
 * has no relations at all.
 */
export function RelationsPanel({ group }: { group: BrainRelationGroup }) {
  const { outgoing, incoming, brokenOutgoing } = group;
  const hasAny =
    outgoing.length > 0 || incoming.length > 0 || brokenOutgoing.length > 0;

  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Relations
      </h2>

      {!hasAny ? (
        <p className="text-sm leading-6 text-[var(--text-muted)]">
          No relations yet. Add IDs to this entry&apos;s{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
            related
          </code>{" "}
          array, or reference it from another entry, to build connections.
        </p>
      ) : (
        <div className="space-y-6">
          {brokenOutgoing.length > 0 && (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/8 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">
                Broken references ({brokenOutgoing.length})
              </p>
              <p className="mt-1.5 text-sm leading-6 text-rose-100/80">
                These related IDs do not exist in any registry. Fix them before
                merge.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {brokenOutgoing.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center rounded-md bg-rose-500/12 px-2 py-0.5 font-mono text-[11px] text-rose-200 ring-1 ring-inset ring-rose-400/20"
                  >
                    {id}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Outgoing ({outgoing.length})
            </p>
            {outgoing.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                This entry does not reference any other entry.
              </p>
            ) : (
              <div className="space-y-2">
                {outgoing.map((node) => (
                  <RelationNodeRow key={`out-${node.kind}-${node.id}`} node={node} />
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Incoming backlinks ({incoming.length})
            </p>
            {incoming.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No other entry references this one yet.
              </p>
            ) : (
              <div className="space-y-2">
                {incoming.map((node) => (
                  <RelationNodeRow key={`in-${node.kind}-${node.id}`} node={node} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
