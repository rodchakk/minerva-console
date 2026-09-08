import { PageHeader } from "@/components/layout/PageHeader";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] ${className}`}
    />
  );
}

export default function EntryNotificationObservabilityLoading() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="ENTRY observability / Notifications"
        description="Notification queue, worker, provider, and onboarding-email evidence."
      />
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-32" />
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)]">
        <SkeletonBlock className="h-[520px]" />
        <SkeletonBlock className="h-[520px]" />
      </section>
    </div>
  );
}

