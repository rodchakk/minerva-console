import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { BrainEyebrow } from "@/features/brain/components/BrainEyebrow";
import { MarkdownDocument } from "@/features/brain/components/MarkdownDocument";
import { RelationsPanel } from "@/features/brain/components/RelationsPanel";
import { getEntryDocument } from "@/features/brain/lib/content";
import { getEntryRelations } from "@/features/brain/lib/relations";
import {
  PLURAL_TO_SINGULAR,
  type RegistryKindPlural,
} from "@/features/brain/lib/types";

const VALID_KINDS = new Set<string>([
  "projects",
  "decisions",
  "prompts",
  "agents",
  "inbox",
  "missions",
]);

export default async function BrainDetailPage(props: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await props.params;

  if (!VALID_KINDS.has(kind)) notFound();

  const pluralKind = kind as RegistryKindPlural;
  const result = getEntryDocument(pluralKind, id);

  if (!result) notFound();

  const { entry, document } = result;
  const singularKind = PLURAL_TO_SINGULAR[pluralKind];
  const isInbox = singularKind === "inbox";
  const relations = getEntryRelations(pluralKind, id);

  return (
    <div className="space-y-8">
      <PageHeader
        title={entry.title}
        description={entry.summary}
        eyebrow={<BrainEyebrow />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/brain/${kind}`}
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400 hover:text-sky-300"
        >
          &larr; Back to {kind}
        </Link>
      </div>

      <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Metadata
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-[var(--text-muted)]">ID</dt>
          <dd className="font-mono text-xs text-white">{entry.id}</dd>

          <dt className="text-[var(--text-muted)]">Type</dt>
          <dd>
            <Badge tone="info">{entry.type}</Badge>
          </dd>

          <dt className="text-[var(--text-muted)]">Status</dt>
          <dd>
            <Badge
              tone={
                entry.status === "approved" || entry.status === "promoted"
                  || entry.status === "completed"
                  ? "success"
                  : entry.status === "draft" ||
                      entry.status === "inbox" ||
                      entry.status === "planned"
                    ? "warning"
                    : entry.status === "in_progress"
                      ? "info"
                    : "default"
              }
            >
              {entry.status}
            </Badge>
          </dd>

          <dt className="text-[var(--text-muted)]">Created</dt>
          <dd className="text-slate-300">{entry.created}</dd>

          <dt className="text-[var(--text-muted)]">Updated</dt>
          <dd className="text-slate-300">{entry.updated}</dd>

          {entry.tags.length > 0 && (
            <>
              <dt className="text-[var(--text-muted)]">Tags</dt>
              <dd className="flex flex-wrap gap-1.5">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </dd>
            </>
          )}

          {entry.related.length > 0 && (
            <>
              <dt className="text-[var(--text-muted)]">Related</dt>
              <dd className="flex flex-wrap gap-1.5">
                {entry.related.map((rel) => (
                  <span
                    key={rel}
                    className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-300"
                  >
                    {rel}
                  </span>
                ))}
              </dd>
            </>
          )}

          {"agent" in entry && (
            <>
              <dt className="text-[var(--text-muted)]">Phase</dt>
              <dd className="text-slate-300">{entry.phase || "Unavailable"}</dd>

              <dt className="text-[var(--text-muted)]">Agent</dt>
              <dd className="text-slate-300">{entry.agent || "Unavailable"}</dd>

              <dt className="text-[var(--text-muted)]">Branch</dt>
              <dd className="font-mono text-xs text-slate-300">
                {entry.branch || "Unavailable"}
              </dd>

              <dt className="text-[var(--text-muted)]">PR</dt>
              <dd className="text-slate-300">{entry.pr || "Unavailable"}</dd>

              <dt className="text-[var(--text-muted)]">Commit</dt>
              <dd className="font-mono text-xs text-slate-300">
                {entry.commit || "Unavailable"}
              </dd>
            </>
          )}

          {entry.path && (
            <>
              <dt className="text-[var(--text-muted)]">Source</dt>
              <dd>
                <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-sky-300">
                  {entry.path}
                </code>
              </dd>
            </>
          )}
        </dl>
      </div>

      {relations && <RelationsPanel group={relations} />}

      {isInbox && <InboxTriagePanel />}

      {document ? (
        <MarkdownDocument body={document.body} sourcePath={document.sourcePath} />
      ) : (
        <div className="rounded-[28px] border border-dashed border-amber-400/30 bg-amber-500/8 px-6 py-10 text-center">
          <h3 className="text-lg font-semibold text-amber-200">
            Document missing
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-100/80">
            {entry.path ? (
              <>
                The file{" "}
                <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
                  {entry.path}
                </code>{" "}
                does not exist yet. Create it to see the full document here.
              </>
            ) : (
              "This entry has no associated document path."
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function InboxTriagePanel() {
  return (
    <div className="space-y-4 rounded-[28px] border border-amber-400/20 bg-amber-500/8 p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
          Raw &middot; Unprocessed
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-100/90">
          This is a raw inbox item. It is{" "}
          <strong className="font-semibold">not</strong> approved Brain
          knowledge. It must be reviewed and promoted by a human before it
          becomes authoritative.
        </p>
      </div>

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
          How to promote
        </h3>
        <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm leading-6 text-amber-100/80">
          <li>
            Review the raw content below for accuracy and relevance.
          </li>
          <li>
            Choose a target type:{" "}
            <strong className="text-amber-100">
              decision, prompt, project, agent,
            </strong>{" "}
            or <strong className="text-amber-100">general doc</strong>.
          </li>
          <li>
            Create a new Markdown file under{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
              content/brain/&#123;type&#125;/
            </code>{" "}
            with the refined content.
          </li>
          <li>
            Add a new entry to the appropriate registry JSON under{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
              content/brain/registries/
            </code>
            .
          </li>
          <li>
            Update this inbox entry&apos;s status to{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
              promoted
            </code>{" "}
            or{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
              archived
            </code>{" "}
            in{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
              content/brain/registries/inbox.json
            </code>
            .
          </li>
          <li>Commit and push the changes.</li>
        </ol>
      </div>
    </div>
  );
}
