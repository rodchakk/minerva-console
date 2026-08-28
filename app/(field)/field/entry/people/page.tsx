import Link from "next/link";
import { ArrowRight, Search, UserRoundSearch } from "lucide-react";
import {
  FIELD_PEOPLE_MIN_QUERY_LENGTH,
  type FieldPeopleSearchResult,
  searchFieldPeople,
} from "@/features/entry/field/globalPeopleSearch";

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getResultHref(result: FieldPeopleSearchResult) {
  if (result.kind === "resident") {
    return `/field/entry/communities/${encodeURIComponent(result.communityId)}/people/residents/${encodeURIComponent(result.userId)}`;
  }

  return `/field/entry/communities/${encodeURIComponent(result.communityId)}/people/activation/${encodeURIComponent(result.queueId)}`;
}

function ResultCard({ result }: { result: FieldPeopleSearchResult }) {
  const status =
    result.kind === "resident"
      ? `Resident - ${result.accountState}`
      : "Pending activation";
  const identity =
    result.kind === "resident" ? result.identity : result.identityHint;

  return (
    <Link
      href={getResultHref(result)}
      className="group flex min-h-24 items-center justify-between gap-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 transition-colors hover:border-[var(--console-accent-border)] hover:bg-[var(--console-surface-hover)] active:bg-white/[0.08]"
    >
      <span className="min-w-0">
        <span className="block break-words text-lg font-semibold leading-6 text-[var(--console-text)]">
          {result.name}
        </span>
        <span className="mt-1 block break-words text-sm leading-5 text-[var(--console-text-muted)]">
          {result.unitLabel} - {result.communityName}
        </span>
        <span className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full border border-[var(--console-border)] bg-white/[0.03] px-2.5 py-1 text-[var(--console-text-muted)]">
            {status}
          </span>
          {result.kind === "pending_activation" ? (
            <span className="rounded-full border border-[var(--console-border)] bg-white/[0.03] px-2.5 py-1 text-[var(--console-text-muted)]">
              {result.activationStatus}
            </span>
          ) : null}
        </span>
        {identity ? (
          <span className="mt-2 block break-words text-sm leading-5 text-[var(--console-text-soft)]">
            {identity}
          </span>
        ) : null}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-[var(--console-text-soft)] transition-colors group-hover:text-[var(--console-text)]"
      />
    </Link>
  );
}

export default async function FieldEntryPeoplePage({
  searchParams,
}: PageProps<"/field/entry/people">) {
  const params = await searchParams;
  const data = await searchFieldPeople(getSearchParam(params.q));

  return (
    <div className="space-y-5">
      <section className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          ENTRY Field
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--console-text)]">
          People
        </h1>
      </section>

      <form action="/field/entry/people" className="space-y-3">
        <label className="block" htmlFor="field-people-search">
          <span className="mb-2 block text-sm font-semibold text-[var(--console-text)]">
            Search name, email or username
          </span>
          <span className="flex min-h-14 items-center gap-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-4 text-[var(--console-text-muted)] focus-within:border-[var(--console-accent-border)] focus-within:ring-4 focus-within:ring-white/5">
            <Search aria-hidden="true" className="h-5 w-5 shrink-0" />
            <input
              id="field-people-search"
              name="q"
              type="search"
              defaultValue={data.query}
              placeholder="Search name, email or username"
              className="min-h-12 w-full bg-transparent text-base text-[var(--console-text)] outline-none placeholder:text-[var(--console-text-soft)]"
            />
          </span>
        </label>
        <button
          type="submit"
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-bold text-white transition-colors hover:brightness-110 active:brightness-95"
        >
          <UserRoundSearch aria-hidden="true" className="h-4 w-4" />
          Search people
        </button>
      </form>

      {data.state === "idle" ? (
        <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-4 text-sm leading-6 text-[var(--console-text-muted)]">
          Find someone across ENTRY.
        </p>
      ) : null}

      {data.state === "too_short" ? (
        <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-4 text-sm leading-6 text-[var(--console-text-muted)]">
          Enter at least {FIELD_PEOPLE_MIN_QUERY_LENGTH} characters to search
          across ENTRY.
        </p>
      ) : null}

      {data.state === "unavailable" ? (
        <section className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          <p className="font-semibold">People search unavailable.</p>
          <p className="mt-1">
            We could not search people right now. Try again before treating this
            as no matches.
          </p>
        </section>
      ) : null}

      {data.state === "ready" ? (
        <section className="space-y-3" aria-label="People search results">
          <p className="text-sm text-[var(--console-text-muted)]">
            {data.results.length} result{data.results.length === 1 ? "" : "s"}
          </p>
          {data.results.length > 0 ? (
            <div className="grid gap-3">
              {data.results.map((result) => (
                <ResultCard
                  key={
                    result.kind === "resident"
                      ? `resident:${result.communityId}:${result.userId}`
                      : `pending_activation:${result.communityId}:${result.queueId}`
                  }
                  result={result}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-4 text-sm leading-6 text-[var(--console-text-muted)]">
              No people found for this search.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
