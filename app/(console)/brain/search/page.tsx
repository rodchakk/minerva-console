import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { BrainEyebrow } from "@/features/brain/components/BrainEyebrow";
import { Badge } from "@/components/ui/Badge";
import {
  searchBrain,
  getBrainTags,
  getBrainKinds,
  getBrainStatuses,
} from "@/features/brain/lib/search";

export default async function BrainSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const kind = typeof params.kind === "string" ? params.kind : "";
  const tag = typeof params.tag === "string" ? params.tag : "";
  const status = typeof params.status === "string" ? params.status : "";

  const hasFilters = q || kind || tag || status;

  const results = hasFilters
    ? searchBrain({ q: q || undefined, kind: kind || undefined, tag: tag || undefined, status: status || undefined })
    : [];

  const allKinds = getBrainKinds();
  const allStatuses = getBrainStatuses();
  const allTags = getBrainTags();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Brain Search"
        description="Search across all Brain registries and Markdown documents. Git-backed, local, read-only."
        eyebrow={<BrainEyebrow />}
      />

      <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
        <form method="GET" action="/brain/search" className="space-y-4">
          <div>
            <label
              htmlFor="q"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
            >
              Search
            </label>
            <input
              id="q"
              name="q"
              type="text"
              defaultValue={q}
              placeholder="Search title, summary, tags, content…"
              className="w-full rounded-xl border border-[var(--border)] bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-400/40 focus:ring-1 focus:ring-sky-400/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="kind"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
              >
                Kind
              </label>
              <select
                id="kind"
                name="kind"
                defaultValue={kind}
                className="w-full rounded-xl border border-[var(--border)] bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-sky-400/40 focus:ring-1 focus:ring-sky-400/20"
              >
                <option value="">All kinds</option>
                {allKinds.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="tag"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
              >
                Tag
              </label>
              <select
                id="tag"
                name="tag"
                defaultValue={tag}
                className="w-full rounded-xl border border-[var(--border)] bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-sky-400/40 focus:ring-1 focus:ring-sky-400/20"
              >
                <option value="">All tags</option>
                {allTags.map((t) => (
                  <option key={t.tag} value={t.tag}>
                    {t.tag} ({t.count})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="status"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="w-full rounded-xl border border-[var(--border)] bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-sky-400/40 focus:ring-1 focus:ring-sky-400/20"
              >
                <option value="">All statuses</option>
                {allStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-xl bg-sky-500/20 px-5 py-2.5 text-sm font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/20 transition-colors hover:bg-sky-500/30"
            >
              Search
            </button>
            {hasFilters ? (
              <Link
                href="/brain/search"
                className="text-sm text-[var(--text-muted)] hover:text-white"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        </form>
      </div>

      {hasFilters ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            {results.length} result{results.length !== 1 ? "s" : ""} found
            {q ? ` for "${q}"` : ""}
            {kind ? ` in ${kind}` : ""}
            {tag ? ` tagged "${tag}"` : ""}
            {status ? ` with status "${status}"` : ""}
          </p>

          {results.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-[var(--border)] px-6 py-10 text-center">
              <p className="text-lg font-semibold text-slate-300">
                No results
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Try adjusting your search query or filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={result.href}
                  className="block rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur transition-colors hover:border-white/20"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-[var(--text-muted)]">
                          {result.id}
                        </span>
                        <Badge tone="info">{result.kind}</Badge>
                        <Badge
                          tone={
                            result.status === "approved" ||
                            result.status === "promoted"
                              ? "success"
                              : result.status === "draft" ||
                                  result.status === "inbox"
                                ? "warning"
                                : "default"
                          }
                        >
                          {result.status}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-white">
                        {result.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                        {result.summary}
                      </p>
                    </div>
                  </div>

                  {(result.tags.length > 0 || result.source) && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {result.tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300"
                        >
                          {t}
                        </span>
                      ))}
                      {result.source ? (
                        <span className="inline-flex items-center rounded-md bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300">
                          source: {result.source}
                        </span>
                      ) : null}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-[var(--border)] px-6 py-10 text-center">
          <p className="text-lg font-semibold text-slate-300">
            Enter a search query or select filters
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Search across all Brain registries, tags, and Markdown documents.
          </p>
        </div>
      )}
    </div>
  );
}
