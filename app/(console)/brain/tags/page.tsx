import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { BrainEyebrow } from "@/features/brain/components/BrainEyebrow";
import { getBrainTags } from "@/features/brain/lib/search";

export default function BrainTagsPage() {
  const tags = getBrainTags();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Brain Tags"
        description="All tags across Brain registries. Click a tag to search entries with that tag."
        eyebrow={<BrainEyebrow />}
      />

      {tags.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[var(--border)] px-6 py-10 text-center">
          <p className="text-lg font-semibold text-slate-300">No tags found</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Tags will appear here once registry entries have tags assigned.
          </p>
        </div>
      ) : (
        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {tags.length} tag{tags.length !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map(({ tag, count }) => (
              <Link
                key={tag}
                href={`/brain/search?tag=${encodeURIComponent(tag)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-white/20 hover:text-white"
              >
                <span>{tag}</span>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-slate-400">
                  {count}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
