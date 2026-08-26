"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { HouseholdDraftForm } from "./HouseholdDraftForm";
import { RegistrationStepper } from "./PublicRegistrationShell";

type LookupResult =
  | {
      available: false;
    }
  | {
      available: true;
      residentLimit: number;
      unitLabel: string;
    };

type LookupState =
  | {
      status: "idle";
    }
  | {
      status: "checking";
    }
  | {
      status: "success";
      result: Extract<LookupResult, { available: true }>;
    }
  | {
      status: "unavailable";
    }
  | {
      status: "rate_limited" | "service_unavailable";
    }
  | {
      status: "error";
    };

const NEUTRAL_UNAVAILABLE_MESSAGE =
  "No pudimos habilitar esta vivienda para el registro. Verifica el número ingresado o comunícate con la administración de tu residencial.";
const RATE_LIMITED_MESSAGE =
  "Has realizado demasiados intentos. Espera un momento e inténtalo nuevamente.";
const SERVICE_UNAVAILABLE_MESSAGE =
  "No pudimos procesar la solicitud en este momento. Intentalo nuevamente.";

export function UnitLookupForm({
  intro,
  slug,
  unitLabelPrefix,
}: {
  intro?: ReactNode;
  slug: string;
  unitLabelPrefix: string;
}) {
  const [unitSuffix, setUnitSuffix] = useState("");
  const [state, setState] = useState<LookupState>({ status: "idle" });

  function resetLookup() {
    setUnitSuffix("");
    setState({ status: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submittedUnitSuffix = unitSuffix.trim();
    if (!submittedUnitSuffix) {
      setState({ status: "unavailable" });
      return;
    }

    setState({ status: "checking" });

    try {
      const response = await fetch(
        `/entry/register/${encodeURIComponent(slug)}/unit`,
        {
          body: JSON.stringify({ unitLabel: submittedUnitSuffix }),
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      if (response.status === 401) {
        window.location.assign(`/entry/register/${encodeURIComponent(slug)}`);
        return;
      }

      if (response.status === 429) {
        setState({ status: "rate_limited" });
        return;
      }

      if (response.status === 503) {
        setState({ status: "service_unavailable" });
        return;
      }

      if (!response.ok) {
        setState({ status: "unavailable" });
        return;
      }

      const result = (await response.json()) as LookupResult;
      if (
        result.available === true &&
        typeof result.unitLabel === "string" &&
        typeof result.residentLimit === "number" &&
        Number.isFinite(result.residentLimit) &&
        result.residentLimit > 0
      ) {
        setState({ status: "success", result });
        return;
      }

      setState({ status: "unavailable" });
    } catch {
      setState({ status: "error" });
    }
  }

  const isChecking = state.status === "checking";

  if (state.status === "success") {
    return (
      <HouseholdDraftForm
        onChangeUnit={resetLookup}
        residentLimit={state.result.residentLimit}
        slug={slug}
        unitLabel={state.result.unitLabel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <RegistrationStepper currentStep={1} />

      {intro ? <div>{intro}</div> : null}

      <section className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-100 px-5 py-6 sm:px-8">
          <div className="flex gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#efe7ff] text-[#5b21b6]">
              <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 24 24">
                <path
                  d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.9"
                />
              </svg>
            </span>
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                Identifica tu vivienda
              </h2>
              <p className="mt-2 text-base leading-7 text-slate-600">
                Ingresa el código de tu vivienda.
              </p>
            </div>
          </div>
        </div>

        <form className="space-y-5 px-5 py-6 sm:px-8" onSubmit={handleSubmit}>
          <label className="block" htmlFor="unit-label">
            <span className="text-base font-bold text-slate-950">
              Número de vivienda
            </span>
            <span className="mt-2 flex min-h-14 items-center rounded-2xl border border-[#5b21b6] bg-white px-4 shadow-[0_0_0_3px_rgba(91,33,182,0.08)] focus-within:border-[#4c1d95]">
              <span className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center text-[#5b21b6]">
                <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.9"
                  />
                </svg>
              </span>
              <span className="mr-2 text-base font-semibold text-slate-500">
                {unitLabelPrefix}
              </span>
              <input
                autoComplete="off"
                className="h-12 min-w-0 flex-1 border-0 bg-transparent text-lg text-slate-950 outline-none placeholder:text-slate-400"
                disabled={isChecking}
                id="unit-label"
                maxLength={40}
                name="unitLabel"
                onChange={(event) => setUnitSuffix(event.target.value)}
                placeholder="Ej. 1 o 5B"
                required
                type="text"
                value={unitSuffix}
              />
            </span>
          </label>

          <div className="flex gap-3 text-sm leading-6 text-slate-500">
            <svg
              aria-hidden="true"
              className="mt-1 h-5 w-5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 17v-6m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            <p>
              Ejemplos:{" "}
              <span className="font-bold text-[#5b21b6]">1, 2, 3, 5B, 6A</span>
            </p>
          </div>

          <button
            className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#4c1d95] px-5 text-base font-bold text-white shadow-[0_16px_34px_rgba(76,29,149,0.24)] transition hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isChecking}
            type="submit"
          >
            {isChecking ? "Verificando..." : "Continuar"}
          </button>
        </form>
      </section>

      <div aria-live="polite">
        {state.status === "unavailable" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
            <p className="text-sm font-semibold text-amber-950">
              Vivienda no habilitada
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              {NEUTRAL_UNAVAILABLE_MESSAGE}
            </p>
          </div>
        ) : null}

        {state.status === "rate_limited" ||
        state.status === "service_unavailable" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
            <p className="text-sm font-semibold text-amber-950">
              No pudimos verificar la vivienda
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              {state.status === "rate_limited"
                ? RATE_LIMITED_MESSAGE
                : SERVICE_UNAVAILABLE_MESSAGE}
            </p>
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
            <p className="text-sm font-semibold text-amber-950">
              No pudimos verificar la vivienda
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              {NEUTRAL_UNAVAILABLE_MESSAGE}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
