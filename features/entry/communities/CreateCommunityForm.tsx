"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Link2,
  MessageSquare,
  Star,
} from "lucide-react";
import { createCommunityAction } from "@/features/entry/communities/actions";
import { BulkUnitsUploader } from "@/features/entry/communities/BulkUnitsUploader";
import { FacilityFields } from "@/features/entry/communities/FacilityFields";
import type { AdvancedUnitsImportPayload } from "@/features/entry/communities/unitsImport";
import { cn } from "@/lib/supabase/utils";

const STEP_ITEMS = [
  { id: 1, label: "Details" },
  { id: 2, label: "Features" },
  { id: 3, label: "Units" },
] as const;

const UNIT_LABEL_OPTIONS = [
  "Casas",
  "Apartamentos",
  "Condominios",
  "Oficinas",
] as const;

const FEATURE_ITEMS = [
  {
    name: "allow_frequent_access",
    title: "Frequent access",
    description: "Enable recurring or fast-entry workflows for residents.",
    icon: Star,
  },
  {
    name: "allow_reservations",
    title: "Reservations",
    description: "Allow amenity, space, or visit reservation flows.",
    icon: CalendarDays,
  },
  {
    name: "allow_messages",
    title: "Messages",
    description: "Allow in-product communication and broadcast tools.",
    icon: MessageSquare,
  },
] as const;

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--console-accent)] px-4 text-xs font-semibold text-white transition-colors hover:bg-[var(--console-accent-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Creating community..." : "Create community"}
    </button>
  );
}

export function CreateCommunityForm() {
  const [state, formAction] = useActionState(createCommunityAction, {});
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [unitLabel, setUnitLabel] = useState("Casas");
  const [allowFrequentAccess, setAllowFrequentAccess] = useState(true);
  const [allowReservations, setAllowReservations] = useState(true);
  const [allowMessages, setAllowMessages] = useState(true);
  const [facilityNames, setFacilityNames] = useState([""]);
  const [unitsInput, setUnitsInput] = useState("");
  const [unitsMode, setUnitsMode] = useState<"advanced" | "simple">("simple");
  const [useRegistrationLink, setUseRegistrationLink] = useState(false);
  const [advancedUnitsImport, setAdvancedUnitsImport] =
    useState<AdvancedUnitsImportPayload | null>(null);
  const [clientError, setClientError] = useState("");

  const panelClassName =
    "rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]";
  const fieldClassName =
    "h-9 w-full rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-3 text-sm text-slate-100 outline-none transition placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]";

  if (state.success) {
    return (
      <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-6 space-y-6">
        <div className="inline-flex items-center rounded-[4px] border border-emerald-400/20 bg-emerald-500/[0.08] px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
          Community created
        </div>
        <h2 className="text-2xl font-semibold text-white">
          {state.communityName} created
        </h2>
        <p className="text-sm leading-6 text-[var(--console-text-muted)]">
          {state.message}
        </p>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Community created", value: 1 },
            { label: "Inserted units", value: state.insertedUnits ?? 0 },
            { label: "Skipped duplicates", value: state.skippedDuplicates ?? 0 },
            { label: "Skipped blank rows", value: state.skippedBlank ?? 0 },
            { label: "Inserted facilities", value: state.insertedFacilities ?? 0 },
            {
              label: "Skipped facilities",
              value:
                (state.skippedFacilityDuplicates ?? 0) +
                (state.skippedFacilityBlank ?? 0),
            },
            { label: "Resident rows parsed", value: state.parsedResidentRows ?? 0 },
            { label: "Activation inserted", value: state.activationInserted ?? 0 },
            { label: "Activation skipped", value: state.activationSkipped ?? 0 },
            {
              label: "Units auto-created",
              value: state.activationMissingUnitsCreated ?? 0,
            },
            {
              label: "Missing unit match",
              value: state.activationRowsWithMissingHouse ?? 0,
            },
            { label: "Activation failed", value: state.activationFailed ?? 0 },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-4"
            >
              <p className="text-xs text-[var(--console-text-muted)]">{metric.label}</p>
              <p className="mt-1.5 text-xl font-semibold text-white">{metric.value}</p>
            </div>
          ))}
        </div>

        {state.usedAdvancedImport ? (
          <div className="space-y-2 rounded-md border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3 text-xs text-amber-200">
            <p>
              Resident imports are stored as pending activation records only. No
              active ENTRY users, emails, or final PINs are created from this flow.
            </p>
            <p>
              Inserted: {state.activationInserted ?? 0}
              {state.activationSkipped
                ? ` · Skipped duplicates: ${state.activationSkipped}`
                : ""}
              {state.activationMissingUnitsCreated
                ? ` · Units auto-created: ${state.activationMissingUnitsCreated}`
                : ""}
              {state.activationRowsWithMissingHouse
                ? ` · Missing unit match: ${state.activationRowsWithMissingHouse}`
                : ""}
              {state.activationFailed ? ` · Failed: ${state.activationFailed}` : ""}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/products/entry/communities"
            className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--console-accent)] px-4 text-xs font-semibold text-white transition-colors hover:bg-[var(--console-accent-hover)]"
          >
            Back to communities
          </Link>
          {state.communityId && (state.activationInserted ?? 0) > 0 ? (
            <Link
              href={`/products/entry/activation?community_id=${state.communityId}`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] px-4 text-xs font-semibold text-slate-200 hover:bg-white/[0.05]"
            >
              Go to Activation Queue
            </Link>
          ) : null}
          <Link
            href="/products/entry/communities/new"
            className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] px-4 text-xs font-semibold text-slate-200 hover:bg-white/[0.05]"
          >
            Create another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-5"
      onSubmit={(event) => {
        if (step !== 3) {
          return;
        }

        if (!useRegistrationLink) {
          event.preventDefault();
          setClientError(
            "Resident registration link must be enabled before creating the community.",
          );
          return;
        }

        if (unitsMode === "advanced") {
          if (!advancedUnitsImport) {
            event.preventDefault();
            setClientError(
              "Parse the advanced import before creating the community.",
            );
            return;
          }

          if (advancedUnitsImport.errors.length > 0) {
            event.preventDefault();
            setClientError(
              "Resolve the blocking advanced import errors before creating the community.",
            );
            return;
          }
        }

        setClientError("");
      }}
    >
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="unit_label" value={unitLabel} />
      <input type="hidden" name="units_mode" value={unitsMode} />
      <input
        type="hidden"
        name="use_registration_link"
        value={String(useRegistrationLink)}
      />
      <input
        type="hidden"
        name="advanced_units_payload"
        value={advancedUnitsImport ? JSON.stringify(advancedUnitsImport) : ""}
      />
      <input
        type="hidden"
        name="allow_frequent_access"
        value={String(allowFrequentAccess)}
      />
      <input
        type="hidden"
        name="allow_reservations"
        value={String(allowReservations)}
      />
      <input type="hidden" name="allow_messages" value={String(allowMessages)} />
      {facilityNames.map((facilityName, index) => (
        <input
          key={`facility-name-${index}`}
          type="hidden"
          name="facility_name"
          value={facilityName}
        />
      ))}

      {/* Stepper Panel */}
      <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-5 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-0">
          {STEP_ITEMS.map((item, index) => {
            const isActive = step === item.id;
            const isCompleted = step > item.id;

            return (
              <div
                key={item.id}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition",
                      isActive || isCompleted
                        ? "bg-[var(--console-accent)] text-white"
                        : "border border-[var(--console-border-strong)] bg-white/[0.02] text-[var(--console-text-muted)]",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 stroke-[2]" />
                    ) : (
                      item.id
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold transition truncate",
                      isActive || isCompleted
                        ? "text-white"
                        : "text-[var(--console-text-muted)]",
                    )}
                  >
                    {item.label}
                  </span>
                </div>

                {index < STEP_ITEMS.length - 1 ? (
                  <div className="hidden min-w-8 flex-1 md:block">
                    <div className="h-0.5 w-full rounded-full bg-[var(--console-border)]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          step > item.id
                            ? "w-full bg-[var(--console-accent)]"
                            : isActive
                              ? "w-full bg-[var(--console-accent)]"
                              : "w-0",
                        )}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Details */}
      {step === 1 ? (
        <section className={cn(panelClassName, "p-6 sm:p-7 space-y-6")}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
              STEP 1
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">Details</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
              Start with the core information for the community before enabling features and importing units.
            </p>
          </div>

          <div className="border-t border-[var(--console-border)]" />

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--console-text-muted)]" htmlFor="name">
                Community name
              </label>
              <input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className={fieldClassName}
                placeholder="Residencial Las Flores"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--console-text-muted)]" htmlFor="city">
                City
              </label>
              <input
                id="city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className={fieldClassName}
                placeholder="San Pedro Sula"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--console-text-muted)]" htmlFor="unit_label">
              Unit label
            </label>
            <div className="relative">
              <select
                id="unit_label"
                value={unitLabel}
                onChange={(event) => setUnitLabel(event.target.value)}
                className={cn(
                  fieldClassName,
                  "appearance-none pr-10 text-slate-100",
                )}
              >
                {UNIT_LABEL_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-[#18181b] text-slate-100">
                    {option}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[var(--console-text-muted)]">
                <ChevronDown className="h-4 w-4 stroke-[1.75]" />
              </span>
            </div>
            <p className="text-xs text-[var(--console-text-muted)]">
              Examples: Casas, Apartamentos, Condominios, Oficinas.
            </p>
          </div>

          <div className="border-t border-[var(--console-border)] pt-2" />

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep((current) => Math.max(1, current - 1))}
              className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] px-4 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep((current) => current + 1)}
              className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--console-accent)] px-4 text-xs font-semibold text-white transition-colors hover:bg-[var(--console-accent-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {/* Step 2: Features */}
      {step === 2 ? (
        <section className={cn(panelClassName, "p-6 sm:p-7 space-y-6")}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
              STEP 2
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">Features</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
              Choose the operational tools this community should launch with.
            </p>
          </div>

          <div className="border-t border-[var(--console-border)]" />

          <div className="grid gap-4 xl:grid-cols-3">
            {FEATURE_ITEMS.map((item) => {
              const Icon = item.icon;
              const checked =
                item.name === "allow_frequent_access"
                  ? allowFrequentAccess
                  : item.name === "allow_reservations"
                    ? allowReservations
                    : allowMessages;
              const onChange =
                item.name === "allow_frequent_access"
                  ? setAllowFrequentAccess
                  : item.name === "allow_reservations"
                    ? setAllowReservations
                    : setAllowMessages;

              return (
                <label
                  key={item.name}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-md border p-4 transition",
                    checked
                      ? "border-[var(--console-accent-border)] bg-[var(--console-surface-raised)]"
                      : "border-[var(--console-border)] bg-[var(--console-surface-raised)] hover:bg-white/[0.035]",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-md border transition",
                        checked
                          ? "border-violet-400/30 bg-[var(--console-accent-subtle)] text-violet-100"
                          : "border-[var(--console-border)] bg-white/[0.025] text-[var(--console-text-muted)]",
                      )}
                    >
                      <Icon className="h-4 w-4 stroke-[1.75]" />
                    </div>

                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-white truncate block">
                        {item.title}
                      </span>
                      <p className="mt-0.5 text-xs leading-5 text-[var(--console-text-muted)] line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(event.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-[var(--console-border-strong)] bg-transparent text-[var(--console-accent)] focus:ring-0 focus:ring-offset-0"
                  />
                </label>
              );
            })}
          </div>

          <FacilityFields
            disabled={!allowReservations}
            value={facilityNames}
            onChange={setFacilityNames}
          />

          <div className="border-t border-[var(--console-border)] pt-2" />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(1, current - 1))}
              className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] px-4 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep((current) => current + 1)}
              className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--console-accent)] px-4 text-xs font-semibold text-white transition-colors hover:bg-[var(--console-accent-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {/* Step 3: Units */}
      {step === 3 ? (
        <section className={cn(panelClassName, "p-6 sm:p-7 space-y-6")}>
          <BulkUnitsUploader
            advancedValue={advancedUnitsImport}
            mode={unitsMode}
            onAdvancedChange={setAdvancedUnitsImport}
            onModeChange={(nextMode) => {
              setUnitsMode(nextMode);
              setClientError("");
            }}
            onSimpleChange={setUnitsInput}
            simpleValue={unitsInput}
          />

          <label className="flex cursor-pointer flex-col gap-3 rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-4 transition hover:bg-white/[0.035] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <input
                type="checkbox"
                checked={useRegistrationLink}
                onChange={(event) => {
                  const nextChecked = event.target.checked;
                  setUseRegistrationLink(nextChecked);
                  if (nextChecked) {
                    setClientError("");
                  }
                }}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--console-border-strong)] bg-transparent text-[var(--console-accent)] focus:ring-0 focus:ring-offset-0"
              />
              <div className="min-w-0">
                <span className="text-sm font-semibold text-white block">
                  Use resident registration link to build the resident and unit list
                </span>
                <p className="mt-0.5 text-xs text-[var(--console-text-muted)]">
                  Recommended when residents will register through the onboarding link instead of importing the full unit list manually.
                </p>
              </div>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-violet-400/20 bg-violet-500/[0.08] px-2.5 py-1 text-xs font-medium text-violet-200">
              <Link2 className="h-3.5 w-3.5 stroke-[1.75]" />
              <span>Pre-onboarding method</span>
            </span>
          </label>

          <div className="border-t border-[var(--console-border)] pt-2" />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(1, current - 1))}
              className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] px-4 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
            >
              Back
            </button>
            <SubmitButton disabled={!useRegistrationLink} />
          </div>
        </section>
      ) : null}

      {clientError ? (
        <p className="rounded-md border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-200">
          {clientError}
        </p>
      ) : null}

      {state.message ? (
        <p className="rounded-md border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-200">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
