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

  const stepClasses = (currentStep: number) =>
    cn(
      "rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset transition",
      step === currentStep
        ? "bg-violet-500/18 text-white ring-violet-400/30"
        : "bg-white/6 text-[var(--text-muted)] ring-white/10",
    );

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
            { label: "Resident rows prepared", value: state.parsedResidentRows ?? 0 },
            { label: "Activation inserted", value: state.activationInserted ?? 0 },
            { label: "Activation skipped", value: state.activationSkipped ?? 0 },
            {
              label: "Missing house match",
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
              active users, emails, or final PINs are created from this flow yet.
            </p>
            <p>
              Inserted: {state.activationInserted ?? 0}
              {state.activationSkipped
                ? ` · Skipped duplicates: ${state.activationSkipped}`
                : ""}
              {state.activationFailed ? ` · Failed: ${state.activationFailed}` : ""}
              {state.activationRowsWithMissingHouse
                ? ` · Missing house match: ${state.activationRowsWithMissingHouse}`
                : ""}
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

      <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
        <div className="flex flex-wrap gap-3">
          <span className={stepClasses(1)}>1. Details</span>
          <span className={stepClasses(2)}>2. Features</span>
          <span className={stepClasses(3)}>3. Units</span>
        </div>
      </div>

      {step === 1 ? (
        <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="name">
                Community name
              </label>
              <input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                placeholder="Residencial Las Flores"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="city">
                City
              </label>
              <input
                id="city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                placeholder="San Pedro Sula"
              />
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="unit_label">
              Unit label
            </label>
            <input
              id="unit_label"
              value={unitLabel}
              onChange={(event) => setUnitLabel(event.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
            />
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Examples: Casas, Apartamentos, Condominios, Oficinas.
            </p>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-5 rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                name: "allow_frequent_access",
                title: "Frequent access",
                description:
                  "Enable recurring or fast-entry workflows for residents.",
                checked: allowFrequentAccess,
                onChange: setAllowFrequentAccess,
              },
              {
                name: "allow_reservations",
                title: "Reservations",
                description:
                  "Allow amenity, space, or visit reservation flows.",
                checked: allowReservations,
                onChange: setAllowReservations,
              },
              {
                name: "allow_messages",
                title: "Messages",
                description:
                  "Allow in-product communication and broadcast tools.",
                checked: allowMessages,
                onChange: setAllowMessages,
              },
            ].map((item) => (
              <label
                key={item.name}
                className="flex cursor-pointer flex-col rounded-3xl border border-white/8 bg-[var(--surface-strong)] p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-semibold text-white">
                    {item.title}
                  </span>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) => item.onChange(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-[var(--primary)]"
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                  {item.description}
                </p>
              </label>
            ))}
          </div>

          <FacilityFields
            disabled={!allowReservations}
            value={facilityNames}
            onChange={setFacilityNames}
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
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

      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={step === 1}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
          >
            Back
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={() => setStep((current) => current + 1)}>
              Continue
            </Button>
          ) : null}
        </div>

        {step === 3 ? <SubmitButton /> : null}
      </div>
    </form>
  );
}
