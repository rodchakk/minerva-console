"use client";

import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import {
  filterFieldCommunities,
  type FieldCommunityListItem,
} from "@/features/entry/field/communitySearch";
import {
  formatFieldCount,
  getFieldStatusToneClass,
} from "@/features/entry/field/formatting";
import { useMemo, useState } from "react";

type CommunityFinderProps = {
  communities: FieldCommunityListItem[];
  error?: string;
  state?: "ready" | "unavailable";
};

function CommunityMeta({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <span className="min-w-0 rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 py-2">
      <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
        {label}
      </span>
      <span className="mt-1 block truncate text-sm font-semibold text-[var(--console-text)]">
        {value}
      </span>
    </span>
  );
}

export function CommunityFinder({
  communities,
  error,
  state = "ready",
}: CommunityFinderProps) {
  const [query, setQuery] = useState("");
  const filteredCommunities = useMemo(
    () => (query.trim() ? filterFieldCommunities(communities, query) : []),
    [communities, query],
  );
  const hasCommunities = communities.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-4">
      <label className="block" htmlFor="field-community-search">
        <span className="mb-2 block text-sm font-semibold text-[var(--console-text)]">
          Find community
        </span>
        <span className="flex min-h-14 items-center gap-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-4 text-[var(--console-text-muted)] focus-within:border-[var(--console-accent-border)] focus-within:ring-4 focus-within:ring-white/5">
          <Search aria-hidden="true" className="h-5 w-5 shrink-0" />
          <input
            id="field-community-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or city"
            className="min-h-12 w-full bg-transparent text-base text-[var(--console-text)] outline-none placeholder:text-[var(--console-text-soft)]"
          />
        </span>
      </label>

      {state === "unavailable" ? (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-5">
          <p className="text-lg font-semibold text-amber-100">
            Community search unavailable
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/85">
            We could not load communities right now. Try again before treating
            this as a zero-result search.
          </p>
          {error ? (
            <p className="mt-3 break-words text-xs leading-5 text-amber-100/70">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {state === "ready" ? (
        <div className="flex items-center justify-between gap-3 text-sm text-[var(--console-text-muted)]">
          <span>
            {hasQuery
              ? `${filteredCommunities.length} matching ${communities.length === 1 ? "community" : "communities"}`
              : "Start typing to find a community."}
          </span>
          {hasQuery ? (
            <button
              type="button"
              className="min-h-10 rounded-lg px-3 font-semibold text-[var(--console-text)] hover:bg-white/5"
              onClick={() => setQuery("")}
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {state === "ready" && hasQuery && !hasCommunities ? (
        <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5">
          <p className="text-lg font-semibold text-[var(--console-text)]">
            No communities available
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
            ENTRY has no authorized communities to show in Field right now.
          </p>
        </div>
      ) : null}

      {state === "ready" && hasQuery && hasCommunities && filteredCommunities.length === 0 ? (
        <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5">
          <p className="text-lg font-semibold text-[var(--console-text)]">
            No matching communities
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
            Try a different community name or city.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3">
        {state === "ready" && hasQuery
          ? filteredCommunities.map((community) => (
              <Link
                key={community.id}
                href={community.href}
                className="group rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 transition-colors hover:border-[var(--console-accent-border)] hover:bg-[var(--console-surface-hover)]"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-xs font-bold",
                          getFieldStatusToneClass(community.statusLabel),
                        ].join(" ")}
                      >
                        {community.statusLabel}
                      </span>
                      {community.activationPendingCount > 0 ? (
                        <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-xs font-bold text-amber-100">
                          {formatFieldCount(community.activationPendingCount)} pending
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-xl font-semibold leading-6 text-[var(--console-text)]">
                      {community.name}
                    </p>
                    <p className="mt-1 truncate text-sm text-[var(--console-text-muted)]">
                      {community.city}
                    </p>
                  </div>
                  <ArrowRight
                    aria-hidden="true"
                    className="mt-1 h-5 w-5 shrink-0 text-[var(--console-text-soft)] transition-colors group-hover:text-[var(--console-text)]"
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <CommunityMeta
                    label="Units"
                    value={formatFieldCount(community.totalUnits)}
                  />
                  <CommunityMeta
                    label="Members"
                    value={formatFieldCount(community.totalMembers)}
                  />
                </div>

                <p className="mt-3 text-sm leading-6 text-[var(--console-text-muted)]">
                  {community.setupLabel}. Next: {community.nextStepLabel}.
                </p>
              </Link>
            ))
          : null}
      </div>
    </div>
  );
}
