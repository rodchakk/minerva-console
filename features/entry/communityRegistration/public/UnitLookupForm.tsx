"use client";

import { useState, type FormEvent } from "react";
import { HouseholdDraftForm } from "./HouseholdDraftForm";

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
      status: "error";
    };

const NEUTRAL_UNAVAILABLE_MESSAGE =
  "No pudimos habilitar esta vivienda para el registro. Verifica el numero ingresado o comunicate con la administracion de tu residencial.";

export function UnitLookupForm({ slug }: { slug: string }) {
  const [unitLabel, setUnitLabel] = useState("");
  const [state, setState] = useState<LookupState>({ status: "idle" });

  function resetLookup() {
    setUnitLabel("");
    setState({ status: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submittedUnitLabel = unitLabel.trim();
    if (!submittedUnitLabel) {
      setState({ status: "unavailable" });
      return;
    }

    setState({ status: "checking" });

    try {
      const response = await fetch(
        `/entry/register/${encodeURIComponent(slug)}/unit`,
        {
          body: JSON.stringify({ unitLabel: submittedUnitLabel }),
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
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">
          Identifica tu vivienda
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Ingresa el numero o nombre exacto de tu casa o vivienda para continuar.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block" htmlFor="unit-label">
          <span className="text-sm font-semibold text-slate-100">
            Numero de casa o vivienda
          </span>
          <input
            autoComplete="off"
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300/50 focus:bg-white/[0.06]"
            disabled={isChecking}
            id="unit-label"
            maxLength={120}
            name="unitLabel"
            onChange={(event) => setUnitLabel(event.target.value)}
            placeholder="Ej. Casa 24"
            required
            type="text"
            value={unitLabel}
          />
        </label>

        <button
          className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-violet-300/25 bg-violet-500/20 px-4 text-sm font-semibold text-white transition hover:border-violet-200/40 hover:bg-violet-500/28 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isChecking}
          type="submit"
        >
          {isChecking ? "Verificando..." : "Buscar vivienda"}
        </button>
      </form>

      <div aria-live="polite">
        {state.status === "unavailable" ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-4">
            <p className="text-sm font-semibold text-amber-100">
              Vivienda no habilitada
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-50/80">
              {NEUTRAL_UNAVAILABLE_MESSAGE}
            </p>
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-4">
            <p className="text-sm font-semibold text-amber-100">
              No pudimos verificar la vivienda
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-50/80">
              {NEUTRAL_UNAVAILABLE_MESSAGE}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
