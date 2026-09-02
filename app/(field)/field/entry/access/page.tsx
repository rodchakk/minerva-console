import Link from "next/link";
import { ArrowRight, Plus, Search, ShieldCheck } from "lucide-react";
import {
  FIELD_PEOPLE_MIN_QUERY_LENGTH,
  type FieldAllPeopleSearchResult,
  searchAllFieldPeople,
} from "@/features/entry/field/allPeopleSearch";

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function AccessUserRow({
  user,
}: {
  user: Extract<FieldAllPeopleSearchResult, { kind: "user" }>;
}) {
  return (
    <Link
      href={`/field/entry/access/roles/${encodeURIComponent(user.communityId)}/${encodeURIComponent(user.userId)}`}
      className="group flex min-h-20 items-center justify-between gap-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-3.5 transition-colors hover:border-[var(--console-accent-border)] hover:bg-[var(--console-surface-hover)] active:bg-white/[0.08]"
    >
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold text-[var(--console-text)]">
          {user.name}
        </span>
        <span className="mt-1 block truncate text-sm text-[var(--console-text-muted)]">
          {user.role} · {user.unitLabel} · {user.communityName}
        </span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-[var(--console-text-soft)] group-hover:text-[var(--console-text)]"
      />
    </Link>
  );
}

export default async function FieldEntryAccessPage({
  searchParams,
}: PageProps<"/field/entry/access">) {
  const params = await searchParams;
  const data = await searchAllFieldPeople(getSearchParam(params.q));
  const users = data.results.filter(
    (
      result,
    ): result is Extract<FieldAllPeopleSearchResult, { kind: "user" }> =>
      result.kind === "user",
  );

  return (
    <div className="space-y-4">
      <section className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          ENTRY Field
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--console-text)]">
          Access
        </h1>
        <p className="mt-2 text-sm leading-5 text-[var(--console-text-muted)]">
          Change ENTRY roles or create a guard account.
        </p>
      </section>

      <Link
        href="/field/entry/access/guards/new"
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-bold text-white transition-colors hover:brightness-110 active:brightness-95"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        Create guard
      </Link>

      <form action="/field/entry/access">
        <label className="block" htmlFor="field-access-search">
          <span className="mb-2 block text-sm font-semibold text-[var(--console-text)]">
            Find account to change role
          </span>
          <span className="flex min-h-13 items-center gap-2 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] pl-3 pr-1.5 text-[var(--console-text-muted)] focus-within:border-[var(--console-accent-border)]">
            <Search aria-hidden="true" className="h-5 w-5 shrink-0" />
            <input
              id="field-access-search"
              name="q"
              type="search"
              defaultValue={data.query}
              placeholder="Name, email or username"
              className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-[var(--console-text)] outline-none placeholder:text-[var(--console-text-soft)]"
            />
            <button
              type="submit"
              aria-label="Search accounts"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/8 text-[var(--console-text)] active:bg-white/15"
            >
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            </button>
          </span>
        </label>
      </form>

      {data.state === "idle" ? (
        <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-5 text-[var(--console-text-muted)]">
          Search any resident, admin or guard across ENTRY.
        </p>
      ) : null}

      {data.state === "too_short" ? (
        <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-5 text-[var(--console-text-muted)]">
          Enter at least {FIELD_PEOPLE_MIN_QUERY_LENGTH} characters.
        </p>
      ) : null}

      {data.state === "unavailable" ? (
        <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-5 text-amber-100">
          Account search is unavailable right now. Try again.
        </p>
      ) : null}

      {data.state === "ready" ? (
        <section className="space-y-2.5" aria-label="Role search results">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-soft)]">
            {users.length} account{users.length === 1 ? "" : "s"}
          </p>
          {users.length > 0 ? (
            <div className="grid gap-2.5">
              {users.map((user) => (
                <AccessUserRow
                  key={`${user.communityId}:${user.userId}`}
                  user={user}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-5 text-[var(--console-text-muted)]">
              No ENTRY accounts found for this search.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
