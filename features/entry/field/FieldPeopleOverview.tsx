"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, House, KeyRound, Search, UserRound } from "lucide-react";
import {
  type FieldActivationRow,
  type FieldResident,
  type FieldUnit,
  filterFieldActivationRows,
  filterFieldResidents,
  filterFieldUnits,
  formatFieldUnitResidentCount,
  isActivationPinEligible,
} from "@/features/entry/field/peopleModel";

type FieldPeopleOverviewProps = {
  activationRows: FieldActivationRow[];
  activationState: "ready" | "unavailable";
  communityId: string;
  residentState: "ready" | "unavailable";
  residents: FieldResident[];
  unitState: "ready" | "unavailable";
  units: FieldUnit[];
};

function SearchBox({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--console-text-soft)]"
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-white/[0.03] py-3 pl-10 pr-3 text-base text-[var(--console-text)] outline-none transition-colors placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent)]"
      />
    </label>
  );
}

function UnavailableState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
      {label} unavailable.
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-4 text-sm leading-6 text-[var(--console-text-muted)]">
      {label}
    </p>
  );
}

export function FieldPeopleOverview({
  activationRows,
  activationState,
  communityId,
  residentState,
  residents,
  unitState,
  units,
}: FieldPeopleOverviewProps) {
  const [residentQuery, setResidentQuery] = useState("");
  const [unitQuery, setUnitQuery] = useState("");
  const [activationQuery, setActivationQuery] = useState("");
  const filteredResidents = filterFieldResidents(residents, residentQuery);
  const filteredUnits = filterFieldUnits(units, unitQuery);
  const filteredActivationRows = filterFieldActivationRows(
    activationRows,
    activationQuery,
  );

  return (
    <div className="space-y-6">
      <section aria-labelledby="field-people" className="space-y-3">
        <div className="flex items-center gap-2">
          <UserRound
            aria-hidden="true"
            className="h-5 w-5 text-[var(--console-accent)]"
          />
          <h2
            id="field-people"
            className="text-xl font-semibold text-[var(--console-text)]"
          >
            People
          </h2>
        </div>

        {residentState === "unavailable" ? (
          <UnavailableState label="People list" />
        ) : (
          <>
            <SearchBox
              label="Search people"
              onChange={setResidentQuery}
              value={residentQuery}
            />
            {filteredResidents.length > 0 ? (
              <div className="space-y-2">
                {filteredResidents.map((resident) => (
                  <Link
                    key={resident.userId}
                    href={`/field/entry/communities/${encodeURIComponent(communityId)}/people/residents/${encodeURIComponent(resident.userId)}`}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="block break-words text-base font-semibold text-[var(--console-text)]">
                          {resident.fullName}
                        </span>
                        <span className="rounded-full border border-[var(--console-border)] bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--console-text-muted)]">
                          {resident.role}
                        </span>
                      </span>
                      <span className="mt-1 block break-words text-sm text-[var(--console-text-muted)]">
                        {resident.houseLabel} - {resident.identity} - {resident.accountState}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-[var(--console-text-soft)]"
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState label="No people match this search." />
            )}
          </>
        )}
      </section>

      <section aria-labelledby="field-units" className="space-y-3">
        <div className="flex items-center gap-2">
          <House
            aria-hidden="true"
            className="h-5 w-5 text-[var(--console-accent)]"
          />
          <h2
            id="field-units"
            className="text-xl font-semibold text-[var(--console-text)]"
          >
            Units
          </h2>
        </div>

        {unitState === "unavailable" ? (
          <UnavailableState label="Unit list" />
        ) : (
          <>
            <SearchBox
              label="Search units"
              onChange={setUnitQuery}
              value={unitQuery}
            />
            {filteredUnits.length > 0 ? (
              <div className="space-y-2">
                {filteredUnits.map((unit) => (
                  <Link
                    key={unit.id}
                    href={`/field/entry/communities/${encodeURIComponent(communityId)}/people/units/${encodeURIComponent(unit.id)}`}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="min-w-0">
                      <span className="block break-words text-base font-semibold text-[var(--console-text)]">
                        {unit.label}
                      </span>
                      <span className="mt-1 block text-sm text-[var(--console-text-muted)]">
                        {formatFieldUnitResidentCount(unit)} - {unit.isActive ? "Active" : "Inactive"}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-[var(--console-text-soft)]"
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState label="No units match this search." />
            )}
          </>
        )}
      </section>

      <section aria-labelledby="field-activation" className="space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound
            aria-hidden="true"
            className="h-5 w-5 text-[var(--console-accent)]"
          />
          <h2
            id="field-activation"
            className="text-xl font-semibold text-[var(--console-text)]"
          >
            Activation
          </h2>
        </div>

        {activationState === "unavailable" ? (
          <UnavailableState label="Activation queue" />
        ) : (
          <>
            <SearchBox
              label="Search activation queue"
              onChange={setActivationQuery}
              value={activationQuery}
            />
            {filteredActivationRows.length > 0 ? (
              <div className="space-y-2">
                {filteredActivationRows.map((row) => (
                  <Link
                    key={row.id}
                    href={`/field/entry/communities/${encodeURIComponent(communityId)}/people/activation/${encodeURIComponent(row.id)}`}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="min-w-0">
                      <span className="block break-words text-base font-semibold text-[var(--console-text)]">
                        {row.resident}
                      </span>
                      <span className="mt-1 block break-words text-sm text-[var(--console-text-muted)]">
                        {row.unit} - {row.method} - {row.status}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {isActivationPinEligible(row) ? (
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-100">
                          PIN
                        </span>
                      ) : null}
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 text-[var(--console-text-soft)]"
                      />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState label="No activation rows match this search." />
            )}
          </>
        )}
      </section>
    </div>
  );
}
