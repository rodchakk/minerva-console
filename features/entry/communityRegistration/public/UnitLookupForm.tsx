"use client";

import {
  useMemo,
  useState,
  type FocusEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { HouseholdDraftForm } from "./HouseholdDraftForm";
import { RegistrationStepper } from "./PublicRegistrationShell";

type RegistrationMode = "existing_units" | "resident_provided_units";

type LookupResult =
  | {
      available: false;
      error?: "already_registered" | "unavailable";
    }
  | {
      available: true;
      registrationMode?: RegistrationMode;
      residentLimit: number;
      unitLabel: string;
      unitReference: string | null;
    };

type LookupState =
  | { status: "idle" }
  | { status: "checking" }
  | {
      status: "success";
      result: Extract<LookupResult, { available: true }>;
    }
  | {
      status: "unavailable";
      reason?: "already_registered" | "unavailable";
    }
  | { status: "rate_limited" | "service_unavailable" }
  | { status: "error" };

const NEUTRAL_UNAVAILABLE_MESSAGE =
  "No pudimos habilitar esta unidad para el registro. Verifica el número de unidad o comunícate con la administración de tu comunidad.";
const ALREADY_REGISTERED_MESSAGE =
  "Esta unidad ya fue registrada. Si crees que se trata de un error, comunícate con la administración de tu comunidad.";
const RATE_LIMITED_MESSAGE =
  "Has realizado demasiados intentos. Espera un momento e inténtalo nuevamente.";
const SERVICE_UNAVAILABLE_MESSAGE =
  "No pudimos procesar la solicitud en este momento. Inténtalo nuevamente.";

function scrollFocusedControlIntoView(event: FocusEvent<HTMLInputElement>) {
  const target = event.currentTarget;
  if (!window.matchMedia("(max-width: 640px)").matches) return;

  window.setTimeout(() => {
    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, 120);
}

function scrollRegistrationToTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ behavior: "smooth", left: 0, top: 0 });
  });
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-GT")
    .replace(/\s+/g, " ")
    .trim();
}

function unitLabelHasPrefix(unitLabel: string, unitLabelPrefix: string) {
  const label = unitLabel.trim().toLocaleLowerCase("es-GT");
  const prefix = unitLabelPrefix.trim().toLocaleLowerCase("es-GT");

  if (!prefix) return false;
  return label === prefix || label.startsWith(`${prefix} `);
}

function inputValueForUnit(
  unitLabel: string,
  unitLabelPrefix: string,
  showUnitLabelPrefix: boolean,
) {
  const trimmedLabel = unitLabel.trim();
  const trimmedPrefix = unitLabelPrefix.trim();

  if (
    showUnitLabelPrefix &&
    trimmedPrefix &&
    unitLabelHasPrefix(trimmedLabel, trimmedPrefix)
  ) {
    return trimmedLabel.slice(trimmedPrefix.length).trimStart();
  }

  return trimmedLabel;
}

export function UnitLookupForm({
  availableUnits = [],
  intro,
  registrationMode,
  slug,
  unitLabelPrefix,
  unitReferences = {},
}: {
  availableUnits?: string[];
  intro?: ReactNode;
  registrationMode: RegistrationMode;
  slug: string;
  unitLabelPrefix: string;
  unitReferences?: Record<string, string>;
}) {
  const [unitGuideQuery, setUnitGuideQuery] = useState("");
  const [unitSuffix, setUnitSuffix] = useState("");
  const [state, setState] = useState<LookupState>({ status: "idle" });

  const showUnitGuide =
    registrationMode === "existing_units" && availableUnits.length > 0;
  const showUnitLabelPrefix =
    registrationMode === "resident_provided_units" ||
    availableUnits.length === 0 ||
    availableUnits.every((unitLabel) =>
      unitLabelHasPrefix(unitLabel, unitLabelPrefix),
    );

  const filteredAvailableUnits = useMemo(() => {
    const query = normalizeSearchValue(unitGuideQuery);
    if (!query) return availableUnits;

    return availableUnits.filter((unitLabel) => {
      const reference = unitReferences[unitLabel]?.trim() ?? "";
      return normalizeSearchValue(`${unitLabel} ${reference}`).includes(query);
    });
  }, [availableUnits, unitGuideQuery, unitReferences]);

  const inputExample = availableUnits[0]
    ? inputValueForUnit(
        availableUnits[0],
        unitLabelPrefix,
        showUnitLabelPrefix,
      )
    : "1 o 5B";

  function resetLookup() {
    setUnitSuffix("");
    setState({ status: "idle" });
    scrollRegistrationToTop();
  }

  function selectAvailableUnit(unitLabel: string) {
    setUnitSuffix(
      inputValueForUnit(unitLabel, unitLabelPrefix, showUnitLabelPrefix),
    );
    setState({ status: "idle" });
  }

  function isSelectedUnit(unitLabel: string) {
    return (
      normalizeSearchValue(
        inputValueForUnit(unitLabel, unitLabelPrefix, showUnitLabelPrefix),
      ) === normalizeSearchValue(unitSuffix)
    );
  }

  const selectedAvailableUnit = showUnitGuide
    ? availableUnits.find((unitLabel) => isSelectedUnit(unitLabel)) ?? null
    : null;
  const selectedAvailableReference = selectedAvailableUnit
    ? unitReferences[selectedAvailableUnit]?.trim() || null
    : null;

  function clearSelectedUnit() {
    setUnitSuffix("");
    setState({ status: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submittedUnitSuffix = unitSuffix.trim();
    if (!submittedUnitSuffix) {
      setState({ reason: "unavailable", status: "unavailable" });
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
        const result = (await response.json().catch(() => null)) as
          | Extract<LookupResult, { available: false }>
          | null;
        setState({
          reason:
            result?.error === "already_registered"
              ? "already_registered"
              : "unavailable",
          status: "unavailable",
        });
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

      setState({
        reason:
          result.available === false && result.error === "already_registered"
            ? "already_registered"
            : "unavailable",
        status: "unavailable",
      });
    } catch {
      setState({ status: "error" });
    }
  }

  const isChecking = state.status === "checking";

  if (state.status === "success") {
    return (
      <HouseholdDraftForm
        onChangeUnit={resetLookup}
        registrationMode={state.result.registrationMode ?? registrationMode}
        residentLimit={state.result.residentLimit}
        slug={slug}
        unitLabel={state.result.unitLabel}
        unitReference={state.result.unitReference ?? null}
      />
    );
  }

  return (
    <div className="space-y-4">
      {intro ? <div>{intro}</div> : null}

      <RegistrationStepper currentStep={1} />

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.07)]">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-8 sm:py-6">
          <div className="flex gap-3 sm:gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#efe7ff] text-[#5b21b6] sm:h-14 sm:w-14">
              <svg
                aria-hidden="true"
                className="h-7 w-7 sm:h-8 sm:w-8"
                fill="none"
                viewBox="0 0 24 24"
              >
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
              <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">
                Identifica tu unidad
              </h2>
              <p className="mt-1 text-base leading-6 text-slate-600 sm:mt-2 sm:leading-7">
                Ingresa el número de tu casa o unidad.
              </p>
            </div>
          </div>
        </div>

        <form
          className="space-y-4 px-5 py-4 sm:space-y-5 sm:px-8 sm:py-6"
          onSubmit={handleSubmit}
        >
          {showUnitGuide ? (
            <details className="group overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/60">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-left text-sm font-bold text-[#35137a] marker:content-none sm:px-5">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-violet-300 bg-white text-[#5b21b6]">
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9.2 9a3 3 0 1 1 5.3 1.9c-.9 1-2.5 1.5-2.5 3.1m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </span>
                  ¿Necesitas ayuda para identificar tu unidad?
                </span>
                <svg
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="m6 9 6 6 6-6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </summary>

              <div className="border-t border-violet-200/80 px-4 py-4 sm:px-5 sm:py-5">
                <p className="text-sm font-semibold leading-6 text-slate-900">
                  Antes de continuar, identifica la unidad que corresponde exactamente a tu vivienda.
                </p>

                <div className="mt-3 space-y-2.5 text-sm leading-5 text-slate-600">
                  {[
                    "Busca tu casa o unidad en la lista disponible.",
                    "Toca la unidad correspondiente para seleccionarla automáticamente.",
                    "Si no estás seguro, no selecciones una unidad al azar. Consulta con la administración de tu comunidad.",
                  ].map((instruction, index) => (
                    <div className="flex gap-3" key={instruction}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-[#5b21b6]">
                        {index + 1}
                      </span>
                      <p className="pt-0.5">{instruction}</p>
                    </div>
                  ))}
                </div>

                <label className="mt-5 block" htmlFor="unit-guide-search">
                  <span className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                    <span>Buscar en unidades disponibles</span>
                    <span className="normal-case tracking-normal text-slate-500">
                      {filteredAvailableUnits.length} de {availableUnits.length}
                    </span>
                  </span>
                  <span className="relative mt-2 block">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                      <svg
                        aria-hidden="true"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    </span>
                    <input
                      autoComplete="off"
                      className="h-11 w-full rounded-xl border border-violet-200 bg-white pl-10 pr-3 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#5b21b6] focus:ring-2 focus:ring-violet-100"
                      id="unit-guide-search"
                      onChange={(event) => setUnitGuideQuery(event.target.value)}
                      placeholder="Buscar por número o referencia..."
                      type="search"
                      value={unitGuideQuery}
                    />
                  </span>
                </label>

                <div className="mt-3 max-h-[21rem] overflow-y-auto rounded-xl border border-violet-100 bg-white">
                  {filteredAvailableUnits.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {filteredAvailableUnits.map((unitLabel) => {
                        const reference = unitReferences[unitLabel]?.trim() || null;
                        const selected = isSelectedUnit(unitLabel);

                        return (
                          <button
                            aria-pressed={selected}
                            className={`flex min-h-[4.25rem] w-full items-center gap-3 px-3.5 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-200 ${
                              selected
                                ? "bg-violet-50"
                                : "bg-white hover:bg-slate-50"
                            }`}
                            key={unitLabel}
                            onClick={() => selectAvailableUnit(unitLabel)}
                            type="button"
                          >
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                selected
                                  ? "bg-violet-100 text-[#5b21b6]"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              <svg
                                aria-hidden="true"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.8"
                                />
                              </svg>
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-base font-bold text-slate-950">
                                {unitLabel}
                              </span>
                              {reference ? (
                                <span className="mt-0.5 block truncate text-sm text-slate-500">
                                  {reference}
                                </span>
                              ) : null}
                            </span>

                            {selected ? (
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#5b21b6] text-white">
                                <svg
                                  aria-hidden="true"
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    d="m6 12 4 4 8-8"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                  />
                                </svg>
                              </span>
                            ) : (
                              <svg
                                aria-hidden="true"
                                className="h-5 w-5 shrink-0 text-slate-400"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  d="m9 6 6 6-6 6"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.8"
                                />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="px-4 py-8 text-center text-sm leading-6 text-slate-500">
                      No encontramos una unidad con esa búsqueda. Verifica el número o consulta con la administración.
                    </p>
                  )}
                </div>
              </div>
            </details>
          ) : null}

          {selectedAvailableUnit ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#5b21b6]">
                  <svg
                    aria-hidden="true"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.9"
                    />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#5b21b6]">
                    Unidad seleccionada
                  </p>
                  <p className="mt-0.5 truncate text-lg font-bold text-slate-950">
                    {selectedAvailableUnit}
                  </p>
                  {selectedAvailableReference ? (
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {selectedAvailableReference}
                    </p>
                  ) : null}
                </div>
                <button
                  className="shrink-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold text-[#4c1d95] transition hover:bg-violet-50"
                  disabled={isChecking}
                  onClick={clearSelectedUnit}
                  type="button"
                >
                  Cambiar
                </button>
              </div>
            </div>
          ) : (
            <label className="block" htmlFor="unit-label">
              <span className="text-base font-bold text-slate-950">
                Número de unidad o casa
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
                {showUnitLabelPrefix ? (
                  <span className="mr-2 text-base font-semibold text-slate-500">
                    {unitLabelPrefix}
                  </span>
                ) : null}
                <input
                  autoComplete="off"
                  className="h-12 min-w-0 flex-1 border-0 bg-transparent text-lg text-slate-950 outline-none placeholder:text-slate-400"
                  disabled={isChecking}
                  id="unit-label"
                  maxLength={40}
                  name="unitLabel"
                  onChange={(event) => setUnitSuffix(event.target.value)}
                  onFocus={scrollFocusedControlIntoView}
                  placeholder={`Ej. ${inputExample}`}
                  required
                  type="text"
                  value={unitSuffix}
                />
              </span>
            </label>
          )}

          {!selectedAvailableUnit ? (
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
                <span className="font-bold text-[#5b21b6]">
                  {availableUnits.length > 0
                    ? availableUnits.slice(0, 5).join(", ")
                    : "1, 2, 3, 5B, 6A"}
                </span>
              </p>
            </div>
          ) : null}

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
              Unidad no disponible
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              {state.reason === "already_registered"
                ? ALREADY_REGISTERED_MESSAGE
                : NEUTRAL_UNAVAILABLE_MESSAGE}
            </p>
          </div>
        ) : null}

        {state.status === "rate_limited" ||
        state.status === "service_unavailable" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
            <p className="text-sm font-semibold text-amber-950">
              No pudimos verificar la unidad
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
              No pudimos verificar la unidad
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
