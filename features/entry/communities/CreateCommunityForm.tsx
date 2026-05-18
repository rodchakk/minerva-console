"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
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
    icon: (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 2.25L9.7 5.7L13.5 6.25L10.75 8.92L11.4 12.7L8 10.92L4.6 12.7L5.25 8.92L2.5 6.25L6.3 5.7L8 2.25Z"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: "allow_reservations",
    title: "Reservations",
    description: "Allow amenity, space, or visit reservation flows.",
    icon: (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <path
          d="M5 1.75V3.25M11 1.75V3.25M2.75 5.25H13.25M4.5 7.75H5.5M7.5 7.75H8.5M10.5 7.75H11.5M4.5 10.25H5.5M7.5 10.25H8.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <rect x="2.75" y="3.25" width="10.5" height="10" rx="2.25" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    ),
  },
  {
    name: "allow_messages",
    title: "Messages",
    description: "Allow in-product communication and broadcast tools.",
    icon: (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <path
          d="M4.75 11.75L2.75 13V4.75C2.75 3.64543 3.64543 2.75 4.75 2.75H11.25C12.3546 2.75 13.25 3.64543 13.25 4.75V9.25C13.25 10.3546 12.3546 11.25 11.25 11.25H4.75V11.75Z"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <path
          d="M5.75 6.75H10.25M5.75 8.75H8.75"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating community..." : "Create community"}
    </Button>
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
  const [advancedUnitsImport, setAdvancedUnitsImport] =
    useState<AdvancedUnitsImportPayload | null>(null);
  const [clientError, setClientError] = useState("");

  const panelClassName =
    cn(
      "rounded-[30px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(16,20,29,0.94),rgba(12,17,25,0.9))] shadow-[0_18px_50px_rgba(2,6,23,0.18)] backdrop-blur",
    );
  const fieldClassName =
    "h-12 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 text-sm text-slate-100 outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/50";

  if (state.success) {
    return (
      <div className="rounded-[32px] border border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(112,104,255,0.16),rgba(17,24,39,0.94))] p-8 shadow-[0_24px_70px_rgba(2,6,23,0.32)] backdrop-blur">
        <div className="inline-flex items-center rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
          Community created
        </div>
        <h2 className="mt-4 text-3xl font-semibold text-white">
          {state.communityName} created
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          {state.message}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              className="rounded-3xl border border-white/10 bg-[var(--surface-elevated)] p-4"
            >
              <p className="text-sm text-[var(--text-muted)]">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
            </div>
          ))}
        </div>

        {state.usedAdvancedImport ? (
          <div className="mt-6 space-y-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
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

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/products/entry/communities">
            <Button>Back to communities</Button>
          </Link>
          {state.communityId && (state.activationInserted ?? 0) > 0 ? (
            <Link
              href={`/products/entry/activation?community_id=${state.communityId}`}
            >
              <Button>Go to Activation Queue</Button>
            </Link>
          ) : null}
          <Link href="/products/entry/communities/new">
            <Button variant="secondary">Create another</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-6"
      onSubmit={(event) => {
        if (step !== 3) {
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

      <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(13,18,31,0.82),rgba(10,14,24,0.68))] px-5 py-4 shadow-[0_16px_40px_rgba(2,6,23,0.14)] backdrop-blur sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-0">
          {STEP_ITEMS.map((item, index) => {
            const isActive = step === item.id;
            const isCompleted = step > item.id;

            return (
              <div
                key={item.id}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-semibold transition",
                      isActive
                        ? "border-violet-300/30 bg-[linear-gradient(180deg,rgba(109,99,255,0.95),rgba(86,78,222,0.92))] text-white shadow-[0_12px_30px_rgba(89,80,243,0.32)]"
                        : isCompleted
                          ? "border-violet-300/20 bg-[var(--primary-soft)] text-violet-100"
                          : "border-white/12 bg-white/[0.03] text-[var(--text-muted)]",
                    )}
                  >
                    {isCompleted ? (
                      <svg
                        aria-hidden="true"
                        className="h-4 w-4"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M3.5 8.25L6.5 11.25L12.5 4.75"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      item.id
                    )}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium transition",
                        isActive || isCompleted
                          ? "text-white"
                          : "text-[var(--text-muted)]",
                      )}
                    >
                      {item.label}
                    </p>
                  </div>
                </div>

                {index < STEP_ITEMS.length - 1 ? (
                  <div className="hidden min-w-8 flex-1 md:block">
                    <div className="h-px w-full bg-white/10">
                      <div
                        className={cn(
                          "h-full transition-all",
                          step > item.id
                            ? "w-full bg-[var(--primary)]"
                            : isActive
                              ? "w-1/2 bg-[var(--primary)]"
                              : "w-0 bg-[var(--primary)]",
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

      {step === 1 ? (
        <section className={cn(panelClassName, "p-6 sm:p-7")}>
          <div className="mb-6 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Step 1
            </p>
            <h2 className="text-xl font-semibold text-white">Details</h2>
            <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Start with the core information for the community before enabling
              features and importing units.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2.5">
              <label className="text-sm font-medium text-slate-200" htmlFor="name">
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
            <div className="space-y-2.5">
              <label className="text-sm font-medium text-slate-200" htmlFor="city">
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

          <div className="mt-5 space-y-2.5">
            <label className="text-sm font-medium text-slate-200" htmlFor="unit_label">
              Unit label
            </label>
            <div className="relative">
              <select
                id="unit_label"
                value={unitLabel}
                onChange={(event) => setUnitLabel(event.target.value)}
                className={cn(
                  fieldClassName,
                  "appearance-none pr-12 text-left text-slate-100",
                )}
              >
                {UNIT_LABEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[var(--text-muted)]">
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M4 6.5L8 10.5L12 6.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <p className="pl-0.5 text-sm leading-6 text-[var(--text-muted)]">
              Examples: Casas, Apartamentos, Condominios, Oficinas.
            </p>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className={cn(panelClassName, "space-y-5 p-6 sm:p-7")}>
          <div className="mb-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Step 2
            </p>
            <h2 className="text-xl font-semibold text-white">Features</h2>
            <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Choose the operational tools this community should launch with.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {FEATURE_ITEMS.map((item) => {
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
                  "flex cursor-pointer items-start gap-4 rounded-[26px] border p-4 transition sm:p-5",
                  checked
                    ? "border-violet-300/16 bg-[linear-gradient(180deg,rgba(109,99,255,0.12),rgba(12,17,25,0.72))]"
                    : "border-white/8 bg-[rgba(12,17,25,0.58)] hover:border-white/12",
                )}
              >
                <div
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-2xl border text-violet-100",
                    checked
                      ? "border-violet-300/18 bg-[linear-gradient(180deg,rgba(109,99,255,0.26),rgba(65,50,170,0.28))]"
                      : "border-white/8 bg-white/[0.03] text-[var(--text-muted)]",
                  )}
                >
                  {item.icon}
                </div>

                <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-base font-semibold text-white">
                      {item.title}
                    </span>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                      {item.description}
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-900 text-[var(--primary)]"
                  />
                </div>
              </label>
            );
            })}
          </div>

          <FacilityFields
            disabled={!allowReservations}
            value={facilityNames}
            onChange={setFacilityNames}
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section className={cn(panelClassName, "p-6 sm:p-7")}>
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
        </section>
      ) : null}

      {clientError ? (
        <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {clientError}
        </p>
      ) : null}

      {state.message ? (
        <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            className="min-w-20"
            disabled={step === 1}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
          >
            Back
          </Button>
          {step < 3 ? (
            <Button
              type="button"
              className="min-w-28"
              onClick={() => setStep((current) => current + 1)}
            >
              Continue
            </Button>
          ) : null}
        </div>

        {step === 3 ? <SubmitButton /> : null}
      </div>
    </form>
  );
}
