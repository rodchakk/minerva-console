"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { createCommunityAction } from "@/features/entry/communities/actions";
import { BulkUnitsUploader } from "@/features/entry/communities/BulkUnitsUploader";
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
  const [unitsInput, setUnitsInput] = useState("");

  const stepClasses = (currentStep: number) =>
    cn(
      "rounded-full px-4 py-2 text-sm font-semibold",
      step === currentStep
        ? "bg-teal-600 text-white"
        : "bg-slate-100 text-slate-500",
    );

  if (state.success) {
    return (
      <div className="rounded-[32px] border border-emerald-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">
          {state.communityName} created
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{state.message}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">Inserted units</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-950">
              {state.insertedUnits ?? 0}
            </p>
          </div>
          <div className="rounded-3xl bg-amber-50 p-4">
            <p className="text-sm text-amber-700">Skipped duplicates</p>
            <p className="mt-2 text-2xl font-semibold text-amber-950">
              {state.skippedDuplicates ?? 0}
            </p>
          </div>
          <div className="rounded-3xl bg-slate-100 p-4">
            <p className="text-sm text-slate-700">Skipped blank rows</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {state.skippedBlank ?? 0}
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/products/entry/communities">
            <Button>Back to communities</Button>
          </Link>
          <Link href="/products/entry/communities/new">
            <Button variant="secondary">Create another</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="unit_label" value={unitLabel} />
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

      <div className="flex flex-wrap gap-3">
        <span className={stepClasses(1)}>1. Details</span>
        <span className={stepClasses(2)}>2. Features</span>
        <span className={stepClasses(3)}>3. Units</span>
      </div>

      {step === 1 ? (
        <section className="rounded-[32px] border border-[var(--border)] bg-white p-8 shadow-sm">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="name">
                Community name
              </label>
              <input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-teal-600"
                placeholder="Residencial Las Flores"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="city">
                City
              </label>
              <input
                id="city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-teal-600"
                placeholder="San Pedro Sula"
              />
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="unit_label">
              Unit label
            </label>
            <input
              id="unit_label"
              value={unitLabel}
              onChange={(event) => setUnitLabel(event.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-teal-600"
            />
            <p className="text-sm leading-6 text-slate-500">
              Examples: Casas, Apartamentos, Condominios, Oficinas.
            </p>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-4 rounded-[32px] border border-[var(--border)] bg-white p-8 shadow-sm md:grid-cols-3">
          {[
            {
              name: "allow_frequent_access",
              title: "Frequent access",
              description: "Enable recurring or fast-entry workflows for residents.",
              checked: allowFrequentAccess,
              onChange: setAllowFrequentAccess,
            },
            {
              name: "allow_reservations",
              title: "Reservations",
              description: "Allow amenity, space, or visit reservation flows.",
              checked: allowReservations,
              onChange: setAllowReservations,
            },
            {
              name: "allow_messages",
              title: "Messages",
              description: "Allow in-product communication and broadcast tools.",
              checked: allowMessages,
              onChange: setAllowMessages,
            },
          ].map((item) => (
            <label
              key={item.name}
              className="flex cursor-pointer flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-semibold text-slate-900">
                  {item.title}
                </span>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(event) => item.onChange(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600"
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.description}
              </p>
            </label>
          ))}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-[32px] border border-[var(--border)] bg-white p-8 shadow-sm">
          <BulkUnitsUploader value={unitsInput} onChange={setUnitsInput} />
        </section>
      ) : null}

      {state.message ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
