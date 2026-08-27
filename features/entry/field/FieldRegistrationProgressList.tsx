"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatFieldCount } from "@/features/entry/field/formatting";
import {
  FIELD_REGISTRATION_PROGRESS_FILTERS,
  filterRegistrationProgressUnits,
  getRegistrationProgressStatusLabel,
  getRegistrationProgressStatusTone,
  type FieldRegistrationProgressFilter,
  type FieldRegistrationProgressUnit,
} from "@/features/entry/field/registrationProgressStatus";

type FieldRegistrationProgressListProps = {
  units: FieldRegistrationProgressUnit[];
};

export function FieldRegistrationProgressList({
  units,
}: FieldRegistrationProgressListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] =
    useState<FieldRegistrationProgressFilter>("all");
  const filteredUnits = useMemo(
    () => filterRegistrationProgressUnits({ filter, query, units }),
    [filter, query, units],
  );
  const hasQuery = query.trim().length > 0;
  const resultLabel =
    filteredUnits.length === units.length && !hasQuery && filter === "all"
      ? `${formatFieldCount(units.length)} units`
      : `${formatFieldCount(filteredUnits.length)} matching units`;

  return (
    <section className="space-y-4">
      <label className="block" htmlFor="field-registration-unit-search">
        <span className="mb-2 block text-sm font-semibold text-[var(--console-text)]">
          Search units
        </span>
        <span className="flex min-h-14 items-center gap-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-4 text-[var(--console-text-muted)] focus-within:border-[var(--console-accent-border)] focus-within:ring-4 focus-within:ring-white/5">
          <Search aria-hidden="true" className="h-5 w-5 shrink-0" />
          <input
            id="field-registration-unit-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by unit label"
            className="min-h-12 w-full bg-transparent text-base text-[var(--console-text)] outline-none placeholder:text-[var(--console-text-soft)]"
          />
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        {FIELD_REGISTRATION_PROGRESS_FILTERS.map((item) => {
          const active = filter === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={[
                "min-h-10 rounded-full border px-3 text-xs font-bold transition-colors",
                active
                  ? "border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] text-[var(--console-text)]"
                  : "border-[var(--console-border)] bg-white/[0.03] text-[var(--console-text-muted)] hover:bg-white/[0.06] hover:text-[var(--console-text)]",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-[var(--console-text-muted)]">
        <span>{resultLabel}</span>
        {hasQuery || filter !== "all" ? (
          <button
            type="button"
            className="min-h-10 rounded-lg px-3 font-semibold text-[var(--console-text)] hover:bg-white/5"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {units.length === 0 ? (
        <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5">
          <p className="text-lg font-semibold text-[var(--console-text)]">
            No participating units
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
            This campaign has no participating units to show.
          </p>
        </div>
      ) : null}

      {units.length > 0 && filteredUnits.length === 0 ? (
        <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5">
          <p className="text-lg font-semibold text-[var(--console-text)]">
            No matching units
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
            Try another unit label or status filter.
          </p>
        </div>
      ) : null}

      <div className="grid gap-2.5">
        {filteredUnits.map((unit) => (
          <article
            key={unit.id}
            className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4"
          >
            <p className="break-words text-base font-semibold leading-6 text-[var(--console-text)]">
              {unit.label}
            </p>
            <span
              className={[
                "mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
                getRegistrationProgressStatusTone(unit.status),
              ].join(" ")}
            >
              {getRegistrationProgressStatusLabel(unit.status)}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
