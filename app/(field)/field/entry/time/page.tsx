import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FieldWorkTimerClient } from "@/features/entry/field/FieldWorkTimerClient";
import { getFieldWorkTimerPageData } from "@/features/entry/field/workTimerQueries";

type FieldEntryTimePageProps = {
  searchParams: Promise<{
    cancelled?: string;
    error?: string;
    month?: string;
    started?: string;
    stopped?: string;
  }>;
};

function getStatus(searchParams: Awaited<FieldEntryTimePageProps["searchParams"]>) {
  if (searchParams.error) return searchParams.error;
  if (searchParams.started) return "started";
  if (searchParams.stopped) return "stopped";
  if (searchParams.cancelled) return "cancelled";
  return undefined;
}

export default async function FieldEntryTimePage({
  searchParams,
}: FieldEntryTimePageProps) {
  const resolvedSearchParams = await searchParams;
  const data = await getFieldWorkTimerPageData(resolvedSearchParams.month);

  return (
    <div className="space-y-5">
      <Link
        href="/field/entry"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        ENTRY
      </Link>

      <section className="pt-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          ENTRY Field
        </p>
        <h1 className="mt-1.5 text-3xl font-semibold text-[var(--console-text)]">
          Tiempo
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-5 text-[var(--console-text-muted)]">
          Registra evidencia simple de trabajo real para ENTRY.
        </p>
      </section>

      <FieldWorkTimerClient
        activeSession={data.activeSession}
        communities={data.communities}
        communityLoadState={data.communityLoadState}
        generatedAtIso={new Date().toISOString()}
        monthKey={data.monthKey}
        recentSessions={data.recentSessions}
        status={getStatus(resolvedSearchParams)}
        summary={data.summary}
      />
    </div>
  );
}
