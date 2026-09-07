import { PageHeader } from "@/components/layout/PageHeader";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] ${className}`}
    />
  );
}

export default function EntryObservabilityLoading() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="ENTRY observability"
        description="Operational health, incidents, usage, and cost visibility for ENTRY."
      />
      <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-32" />
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.88fr)]">
        <SkeletonBlock className="h-[360px]" />
        <SkeletonBlock className="h-[360px]" />
      </section>
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(520px,0.85fr)]">
        <SkeletonBlock className="h-[340px]" />
        <SkeletonBlock className="h-[340px]" />
      </section>
    </div>
  );
}
