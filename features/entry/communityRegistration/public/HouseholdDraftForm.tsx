"use client";

import { useMemo, useState, type FormEvent } from "react";
import { buildHouseholdSubmissionResidents } from "./submissionPayload";
import { RegistrationStepper } from "./PublicRegistrationShell";

type Relationship = "" | "owner" | "tenant" | "family" | "other";

type ResidentDraft = {
  email: string;
  fullName: string;
  id: number;
  isOwnerReference: boolean;
  phone: string;
  relationship: Relationship;
};

type ResidentErrors = Partial<
  Record<"duplicate" | "email" | "fullName" | "ownerReference" | "phone", string>
>;

type ValidResidentDraft = ResidentDraft & {
  normalizedEmail: string;
  normalizedFullName: string;
  normalizedPhone: string;
  position: number;
};

export type InitialHouseholdResidentDraft = {
  email?: string | null;
  fullName: string;
  isOwnerReference: boolean;
  phone?: string | null;
  relationshipToHouse: Exclude<Relationship, ""> | "unknown";
};

type FinalAction = "correction-submit" | "local-review" | "submit";

const MIN_RESIDENTS = 1;
const NAME_MAX_LENGTH = 160;
const EMAIL_MAX_LENGTH = 254;
const PHONE_MAX_LENGTH = 32;

const RELATIONSHIP_OPTIONS: Array<{
  label: string;
  value: Exclude<Relationship, "">;
}> = [
  { label: "Propietario", value: "owner" },
  { label: "Inquilino", value: "tenant" },
  { label: "Familiar", value: "family" },
  { label: "Otro", value: "other" },
];

const RELATIONSHIP_LABELS: Record<Relationship | "unknown", string> = {
  "": "No especificada",
  family: "Familiar",
  other: "Otro",
  owner: "Propietario",
  tenant: "Inquilino",
  unknown: "No especificada",
};

function createResidentDraft(id: number): ResidentDraft {
  return {
    email: "",
    fullName: "",
    id,
    isOwnerReference: false,
    phone: "",
    relationship: "",
  };
}

function createResidentDraftFromInitial(
  resident: InitialHouseholdResidentDraft,
  id: number,
): ResidentDraft {
  return {
    email: resident.email ?? "",
    fullName: resident.fullName,
    id,
    isOwnerReference: resident.isOwnerReference,
    phone: resident.phone ?? "",
    relationship:
      resident.relationshipToHouse === "unknown"
        ? ""
        : resident.relationshipToHouse,
  };
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.trim().replace(/[\s().-]+/g, "");
}

function validateResidents(residents: ResidentDraft[]) {
  const errors: Record<number, ResidentErrors> = {};
  const seenKeys = new Set<string>();
  let ownerReferenceCount = 0;

  const validResidents: ValidResidentDraft[] = residents.map((resident, index) => {
    const residentErrors: ResidentErrors = {};
    const normalizedFullName = normalizeName(resident.fullName);
    const normalizedEmail = normalizeEmail(resident.email);
    const normalizedPhone = normalizePhone(resident.phone);
    const phoneDigits = normalizedPhone.replace(/[^0-9]/g, "");

    if (!normalizedFullName) {
      residentErrors.fullName = "Ingresa el nombre completo.";
    } else if (normalizedFullName.length > NAME_MAX_LENGTH) {
      residentErrors.fullName = "Usa un nombre de 160 caracteres o menos.";
    }

    if (
      normalizedEmail &&
      (normalizedEmail.length > EMAIL_MAX_LENGTH ||
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail))
    ) {
      residentErrors.email = "Ingresa un correo valido.";
    }

    if (
      normalizedPhone &&
      (normalizedPhone.length > PHONE_MAX_LENGTH ||
        !/^\+?[0-9]+$/.test(normalizedPhone) ||
        phoneDigits.length < 7)
    ) {
      residentErrors.phone = "Revisa el número de teléfono.";
    }

    if (resident.isOwnerReference) {
      ownerReferenceCount += 1;
      if (resident.relationship !== "owner") {
        residentErrors.ownerReference =
          "La referencia de propietario debe tener relación Propietario.";
      }
    }

    const duplicateKey = [
      normalizedFullName.toLowerCase(),
      normalizedEmail,
      normalizedPhone,
    ].join("|");
    if (normalizedFullName && seenKeys.has(duplicateKey)) {
      residentErrors.duplicate = "Este residente ya esta agregado.";
    }
    seenKeys.add(duplicateKey);

    if (Object.keys(residentErrors).length > 0) {
      errors[resident.id] = residentErrors;
    }

    return {
      ...resident,
      normalizedEmail,
      normalizedFullName,
      normalizedPhone,
      position: index + 1,
    };
  });

  if (ownerReferenceCount > 1) {
    residents.forEach((resident) => {
      if (resident.isOwnerReference) {
        errors[resident.id] = {
          ...errors[resident.id],
          ownerReference: "Solo puede haber un propietario de referencia.",
        };
      }
    });
  }

  return {
    errors,
    validResidents,
  };
}

function hasResidentContent(resident: ResidentDraft) {
  return (
    resident.fullName.trim() ||
    resident.email.trim() ||
    resident.phone.trim() ||
    resident.relationship ||
    resident.isOwnerReference
  );
}
function getErrorId(residentId: number, field: keyof ResidentErrors) {
  return `resident-${residentId}-${field}-error`;
}

function getFieldErrorIds(residentId: number, errors?: ResidentErrors) {
  if (!errors) return undefined;

  return (Object.keys(errors) as Array<keyof ResidentErrors>)
    .map((field) => getErrorId(residentId, field))
    .join(" ");
}

function ResidentIcon({ plus = false }: { plus?: boolean }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#efe7ff] text-[#5b21b6]">
      <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        {plus ? (
          <path
            d="M18 9v6m-3-3h6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        ) : null}
      </svg>
    </span>
  );
}

function SelectedUnitCard({
  onChangeUnit,
  onRequestChange,
  residentLimit,
  unitLabel,
}: {
  onChangeUnit?: () => void;
  onRequestChange: () => void;
  residentLimit: number;
  unitLabel: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#efe7ff] text-[#5b21b6]">
          <svg aria-hidden="true" className="h-9 w-9" fill="none" viewBox="0 0 24 24">
            <path
              d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.9"
            />
            <path
              d="m15.5 9.5 1.5 1.5 3-3"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.9"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-slate-950">Vivienda seleccionada</p>
          <p className="mt-1 text-2xl font-bold text-[#4c1d95]">{unitLabel}</p>
          <p className="mt-1 text-sm text-slate-500">
            Puedes registrar hasta {residentLimit} residentes.
          </p>
        </div>
        {onChangeUnit ? (
          <button
            className="hidden shrink-0 items-center gap-2 text-sm font-bold text-[#4c1d95] transition hover:text-[#5b21b6] sm:inline-flex"
            onClick={onRequestChange}
            type="button"
          >
            Cambiar vivienda
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path
                d="m9 18 6-6-6-6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        ) : null}
      </div>
      {onChangeUnit ? (
        <button
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#5b21b6] px-4 py-3 text-sm font-bold text-[#4c1d95] sm:hidden"
          onClick={onRequestChange}
          type="button"
        >
          Cambiar vivienda
        </button>
      ) : null}
    </section>
  );
}

function ResidentSummaryCard({
  index,
  onEdit,
  onRemove,
  resident,
  removable,
}: {
  index: number;
  onEdit: () => void;
  onRemove: () => void;
  resident: ResidentDraft;
  removable: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_14px_46px_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-4">
        <ResidentIcon />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase text-[#4c1d95]">
            Residente {index + 1}
          </p>
          <p className="mt-1 truncate text-lg font-bold text-slate-950">
            {normalizeName(resident.fullName)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {RELATIONSHIP_LABELS[resident.relationship || "unknown"]}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label={`Editar residente ${index + 1}`}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#4c1d95] transition hover:bg-[#efe7ff]"
            onClick={onEdit}
            type="button"
          >
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
              <path
                d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
          {removable ? (
            <button
              aria-label={`Eliminar residente ${index + 1}`}
              className="flex h-10 w-10 items-center justify-center rounded-full text-rose-600 transition hover:bg-rose-50"
              onClick={onRemove}
              type="button"
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                <path
                  d="M5 7h14m-9 4v6m4-6v6M9 7l1-2h4l1 2m2 0-.7 12a2 2 0 0 1-2 2H9.7a2 2 0 0 1-2-2L7 7"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
      <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Telefono</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {normalizePhone(resident.phone) || "No indicado"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Correo</dt>
          <dd className="mt-1 truncate font-semibold text-slate-900">
            {normalizeEmail(resident.email) || "No indicado"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function HouseholdDraftForm({
  finalAction = "submit",
  initialResidents,
  introText,
  onChangeUnit,
  residentLimit,
  slug,
  unitLabel,
}: {
  finalAction?: FinalAction;
  initialResidents?: InitialHouseholdResidentDraft[];
  introText?: string;
  residentLimit: number;
  slug: string;
  unitLabel: string;
  onChangeUnit?: () => void;
}) {
  const initialDrafts =
    initialResidents && initialResidents.length > 0
      ? initialResidents.map((resident, index) =>
          createResidentDraftFromInitial(resident, index + 1),
        )
      : [];
  const initialSavedIds = initialDrafts.map((resident) => resident.id);
  const [nextResidentId, setNextResidentId] = useState(initialDrafts.length + 1);
  const [residents, setResidents] = useState<ResidentDraft[]>(initialDrafts);
  const [savedResidentIds, setSavedResidentIds] = useState<number[]>(initialSavedIds);
  const [activeResidentId, setActiveResidentId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, ResidentErrors>>({});
  const [reviewResidents, setReviewResidents] = useState<ValidResidentDraft[]>([]);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<
    | "access_unavailable"
    | "rate_limited"
    | "service_unavailable"
    | "try_again"
    | "unavailable"
    | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"edit" | "review" | "success">("edit");
  const [confirmingUnitChange, setConfirmingUnitChange] = useState(false);

  const savedResidents = residents.filter((resident) =>
    savedResidentIds.includes(resident.id),
  );
  const activeResident =
    activeResidentId === null
      ? null
      : residents.find((resident) => resident.id === activeResidentId) ?? null;
  const isAtLimit = residents.length >= residentLimit;
  const canRemoveResident = residents.length > MIN_RESIDENTS;
  const hasDraftContent = useMemo(
    () => residents.some((resident) => hasResidentContent(resident)),
    [residents],
  );
  const isCorrectionSubmit = finalAction === "correction-submit";

  function markResidentSaved(residentId: number) {
    setSavedResidentIds((current) =>
      current.includes(residentId) ? current : [...current, residentId],
    );
  }

  function updateResident(
    residentId: number,
    updates: Partial<Omit<ResidentDraft, "id">>,
  ) {
    setResidents((current) =>
      current.map((resident) => {
        if (resident.id !== residentId) return resident;

        const nextResident = {
          ...resident,
          ...updates,
        };

        if (updates.relationship && updates.relationship !== "owner") {
          nextResident.isOwnerReference = false;
        }

        if (updates.isOwnerReference) {
          return nextResident.relationship === "owner"
            ? nextResident
            : { ...nextResident, isOwnerReference: false };
        }

        return nextResident;
      }),
    );
    setStep("edit");
    setDraftNotice(null);
    setSubmitError(null);
  }

  function setOwnerReference(residentId: number, checked: boolean) {
    setResidents((current) =>
      current.map((resident) => ({
        ...resident,
        isOwnerReference:
          resident.id === residentId &&
          checked &&
          resident.relationship === "owner",
      })),
    );
    setStep("edit");
    setDraftNotice(null);
    setSubmitError(null);
  }

  function addResident() {
    if (isAtLimit || activeResidentId !== null) return;

    const resident = createResidentDraft(nextResidentId);
    setResidents((current) => [...current, resident]);
    setNextResidentId((current) => current + 1);
    setActiveResidentId(resident.id);
    setStep("edit");
    setDraftNotice(null);
    setSubmitError(null);
  }

  function editResident(residentId: number) {
    setActiveResidentId(residentId);
    setStep("edit");
    setDraftNotice(null);
    setSubmitError(null);
  }

  function removeResident(residentId: number) {
    if (!canRemoveResident) return;

    setResidents((current) =>
      current.filter((resident) => resident.id !== residentId),
    );
    setSavedResidentIds((current) => current.filter((id) => id !== residentId));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[residentId];
      return nextErrors;
    });
    if (activeResidentId === residentId) {
      setActiveResidentId(null);
    }
    setStep("edit");
    setDraftNotice(null);
    setSubmitError(null);
  }

  function requestUnitChange() {
    if (!onChangeUnit) return;

    if (hasDraftContent || residents.length > MIN_RESIDENTS) {
      setConfirmingUnitChange(true);
      return;
    }

    onChangeUnit();
  }

  function saveActiveResident(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (activeResidentId === null) return;

    const result = validateResidents(residents);
    setErrors(result.errors);

    if (result.errors[activeResidentId]) {
      setDraftNotice("Revisa los campos marcados antes de guardar.");
      return;
    }

    markResidentSaved(activeResidentId);
    setActiveResidentId(null);
    setDraftNotice(null);
    setSubmitError(null);
  }

  function handleReview() {
    if (activeResidentId !== null) {
      setDraftNotice("Guarda el residente abierto antes de continuar.");
      return;
    }

    if (residents.length < MIN_RESIDENTS) {
      setDraftNotice("Agrega al menos un residente para continuar.");
      return;
    }

    const result = validateResidents(residents);
    setErrors(result.errors);

    if (Object.keys(result.errors).length > 0) {
      const firstErrorId = Number(Object.keys(result.errors)[0]);
      setActiveResidentId(Number.isFinite(firstErrorId) ? firstErrorId : null);
      setStep("edit");
      setDraftNotice("Revisa la información antes de continuar.");
      return;
    }

    setReviewResidents(result.validResidents);
    setSubmitError(null);
    setDraftNotice(null);
    setStep("review");
  }

  async function handleFinalSubmit() {
    if (isSubmitting || reviewResidents.length < MIN_RESIDENTS) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const submissionResidents =
        buildHouseholdSubmissionResidents(reviewResidents);
      const response = await fetch(
        `/entry/register/${encodeURIComponent(slug)}${
          isCorrectionSubmit ? "/correct" : ""
        }/submit`,
        {
          body: JSON.stringify({
            residents: submissionResidents,
            ...(isCorrectionSubmit ? {} : { unitLabel }),
          }),
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
        if (isCorrectionSubmit) {
          setSubmitError("access_unavailable");
          return;
        }

        window.location.assign(`/entry/register/${encodeURIComponent(slug)}`);
        return;
      }

      const result = (await response.json().catch(() => null)) as
        | {
            error?:
              | "access_unavailable"
              | "rate_limited"
              | "service_unavailable"
              | "try_again"
              | "unavailable";
            submitted?: boolean;
          }
        | null;

      if (response.ok && result?.submitted === true) {
        setResidents([]);
        setSavedResidentIds([]);
        setNextResidentId(1);
        setReviewResidents([]);
        setErrors({});
        setActiveResidentId(null);
        setStep("success");
        return;
      }

      if (result?.error === "access_unavailable") {
        setSubmitError("access_unavailable");
      } else if (result?.error === "rate_limited") {
        setSubmitError("rate_limited");
      } else if (result?.error === "service_unavailable") {
        setSubmitError("service_unavailable");
      } else {
        setSubmitError(
          result?.error === "unavailable" ? "unavailable" : "try_again",
        );
      }
    } catch {
      setSubmitError("try_again");
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentStep = step === "review" || step === "success" ? 3 : 2;

  return (
    <div className="space-y-6">
      <RegistrationStepper currentStep={currentStep} isComplete={step === "success"} />

      <SelectedUnitCard
        onChangeUnit={onChangeUnit}
        onRequestChange={requestUnitChange}
        residentLimit={residentLimit}
        unitLabel={unitLabel}
      />

      {confirmingUnitChange && onChangeUnit ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
          <p className="text-sm font-semibold text-amber-950">
            Cambiar vivienda borrara este borrador.
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Para evitar asociar residentes a otra vivienda, la información local
            se limpiara antes de buscar una nueva vivienda.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              onClick={() => setConfirmingUnitChange(false)}
              type="button"
            >
              Conservar vivienda
            </button>
            <button
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-amber-500 px-4 text-sm font-bold text-white transition hover:bg-amber-600"
              onClick={onChangeUnit}
              type="button"
            >
              Cambiar y borrar borrador
            </button>
          </div>
        </div>
      ) : null}

      {step === "success" ? (
        <section className="space-y-5" aria-labelledby="household-success-title">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-8 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_16px_32px_rgba(5,150,105,0.24)]">
              <svg aria-hidden="true" className="h-10 w-10" fill="none" viewBox="0 0 24 24">
                <path
                  d="m6 12 4 4 8-9"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />
              </svg>
            </div>
            <h2
              className="mt-5 text-3xl font-bold text-emerald-700"
              id="household-success-title"
            >
              {isCorrectionSubmit ? "Cambios enviados" : "Registro enviado"}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base leading-7 text-slate-600">
              {isCorrectionSubmit
                ? "Tu información actualizada fue enviada correctamente a la administración de tu residencial."
                : "Tu información fue enviada correctamente a la administración de tu residencial."}
            </p>
            <p className="mx-auto mt-4 max-w-md text-base font-semibold text-emerald-700">
              Ya puedes cerrar esta página.
            </p>
          </div>
        </section>
      ) : step === "review" ? (
        <section className="space-y-5" aria-labelledby="household-review-title">
          <div>
            <h2 className="text-3xl font-bold text-slate-950" id="household-review-title">
              Revisar información
            </h2>
            <p className="mt-2 text-base leading-7 text-slate-600">
              Revisa la información antes de enviarla a la administración de tu residencial.
            </p>
          </div>

          <div className="space-y-3">
            {reviewResidents.map((resident) => (
              <article
                className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-[0_14px_46px_rgba(15,23,42,0.06)]"
                key={resident.id}
              >
                <div className="flex items-start gap-4">
                  <ResidentIcon />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold uppercase text-[#4c1d95]">
                        Residente {resident.position}
                      </p>
                      <button
                        className="inline-flex items-center gap-2 text-sm font-bold text-[#4c1d95]"
                        onClick={() => {
                          setSubmitError(null);
                          setStep("edit");
                          setActiveResidentId(resident.id);
                        }}
                        type="button"
                      >
                        Editar
                      </button>
                    </div>
                    <p className="mt-2 text-lg font-bold text-slate-950">
                      {resident.normalizedFullName}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">Relación</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {RELATIONSHIP_LABELS[resident.relationship || "unknown"]}
                      {resident.isOwnerReference
                        ? " - propietario de referencia"
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Teléfono</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {resident.normalizedPhone || "No indicado"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Correo</dt>
                    <dd className="mt-1 truncate font-semibold text-slate-900">
                      {resident.normalizedEmail || "No indicado"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm leading-6 text-slate-600">
              {finalAction === "local-review"
                ? "Los cambios podrán enviarse en el siguiente paso. Esta revisión local todavía no actualiza el registro."
                : isCorrectionSubmit
                  ? "Al enviar estos cambios, la información actualizada se compartirá con la administración de tu residencial para su revisión."
                  : "Al enviar este registro, la información de residentes se compartirá con la administración de tu residencial para su revisión."}
            </p>
          </div>

          <div aria-live="polite">
            {submitError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
                <p className="text-sm font-semibold text-amber-950">
                  {isCorrectionSubmit
                    ? "No pudimos enviar los cambios"
                    : "No pudimos enviar el registro"}
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  {submitError === "access_unavailable"
                    ? "Este enlace de corrección ya no está disponible."
                    : submitError === "rate_limited"
                      ? "Has realizado demasiados intentos. Espera un momento e inténtalo nuevamente."
                      : submitError === "service_unavailable"
                        ? "No pudimos procesar la solicitud en este momento. Inténtalo nuevamente."
                        : submitError === "unavailable"
                          ? "No pudimos completar el registro. Verifica el enlace o comunícate con la administración."
                          : isCorrectionSubmit
                            ? "No pudimos confirmar si los cambios se guardaron. No se reintentará automáticamente; actualiza o abre de nuevo el enlace oficial para verificar si sigue disponible antes de intentarlo otra vez."
                            : "No pudimos confirmar si el registro se guardó. No se reintentará automáticamente; verifica con la administración antes de enviarlo otra vez."}
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="inline-flex h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              onClick={() => {
                setSubmitError(null);
                setStep("edit");
              }}
              type="button"
            >
              Editar información
            </button>
            <button
              className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#4c1d95] px-4 text-base font-bold text-white shadow-[0_16px_34px_rgba(76,29,149,0.24)] transition hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={finalAction === "local-review" || isSubmitting}
              onClick={
                finalAction === "local-review" ? undefined : handleFinalSubmit
              }
              type="button"
            >
              {finalAction === "local-review"
                ? "Envío disponible en el siguiente paso"
                : isSubmitting
                  ? isCorrectionSubmit
                    ? "Enviando cambios..."
                    : "Enviando..."
                  : isCorrectionSubmit
                    ? "Enviar cambios"
                    : "Enviar registro"}
            </button>
          </div>
        </section>
      ) : (
        <section className="space-y-5" aria-labelledby="household-edit-title">
          <div>
            <div className="flex items-start gap-3">
              <span className="mt-1 text-[#5b21b6]">
                <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9a6 6 0 0 1 12 0m6-9v6m-3-3h6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-2xl font-bold text-slate-950" id="household-edit-title">
                  Residentes de la vivienda
                </h2>
                <p className="mt-1 text-base leading-7 text-slate-600">
                  {introText ??
                    "Agrega la información de las personas que viven en esta vivienda."}
                </p>
              </div>
            </div>
          </div>

          {savedResidents.length > 0 ? (
            <div className="space-y-3">
              {savedResidents.map((resident) => {
                const index = residents.findIndex((item) => item.id === resident.id);
                return activeResidentId === resident.id ? null : (
                  <ResidentSummaryCard
                    index={index}
                    key={resident.id}
                    onEdit={() => editResident(resident.id)}
                    onRemove={() => removeResident(resident.id)}
                    removable={canRemoveResident}
                    resident={resident}
                  />
                );
              })}
            </div>
          ) : null}

          {!activeResident && savedResidents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
              <div className="flex justify-center">
                <ResidentIcon plus />
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-950">
                Aún no has agregado residentes
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Empieza con la primera persona que vive en esta vivienda.
              </p>
              <button
                className="mt-5 inline-flex h-12 items-center justify-center rounded-2xl bg-[#4c1d95] px-5 text-sm font-bold text-white transition hover:bg-[#5b21b6]"
                onClick={addResident}
                type="button"
              >
                Agregar residente
              </button>
            </div>
          ) : null}

          {activeResident ? (
            <form
              aria-describedby={getFieldErrorIds(
                activeResident.id,
                errors[activeResident.id],
              )}
              className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
              noValidate
              onSubmit={saveActiveResident}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ResidentIcon plus={!savedResidentIds.includes(activeResident.id)} />
                  <div>
                    <p className="text-sm font-bold uppercase text-[#4c1d95]">
                      Residente{" "}
                      {residents.findIndex((resident) => resident.id === activeResident.id) + 1}
                    </p>
                    <h3 className="text-xl font-bold text-slate-950">
                      {savedResidentIds.includes(activeResident.id)
                        ? "Editar residente"
                        : "Nuevo residente"}
                    </h3>
                  </div>
                </div>
                {canRemoveResident ? (
                  <button
                    className="text-sm font-bold text-rose-600"
                    onClick={() => removeResident(activeResident.id)}
                    type="button"
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>

              <label className="block" htmlFor={`resident-${activeResident.id}-name`}>
                <span className="text-sm font-bold text-slate-950">
                  Nombre completo
                </span>
                <input
                  aria-invalid={errors[activeResident.id]?.fullName ? "true" : "false"}
                  aria-describedby={
                    errors[activeResident.id]?.fullName
                      ? getErrorId(activeResident.id, "fullName")
                      : undefined
                  }
                  autoComplete="name"
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_rgba(91,33,182,0.10)]"
                  id={`resident-${activeResident.id}-name`}
                  maxLength={NAME_MAX_LENGTH}
                  name={`resident-${activeResident.id}-name`}
                  onChange={(event) =>
                    updateResident(activeResident.id, {
                      fullName: event.target.value,
                    })
                  }
                  placeholder="Ej. Ana Martínez"
                  required
                  type="text"
                  value={activeResident.fullName}
                />
                {errors[activeResident.id]?.fullName ? (
                  <p
                    className="mt-2 text-sm leading-5 text-amber-700"
                    id={getErrorId(activeResident.id, "fullName")}
                  >
                    {errors[activeResident.id]?.fullName}
                  </p>
                ) : null}
              </label>

              <label className="block" htmlFor={`resident-${activeResident.id}-relationship`}>
                <span className="text-sm font-bold text-slate-950">
                  Relación con la vivienda
                </span>
                <select
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_rgba(91,33,182,0.10)]"
                  id={`resident-${activeResident.id}-relationship`}
                  name={`resident-${activeResident.id}-relationship`}
                  onChange={(event) =>
                    updateResident(activeResident.id, {
                      relationship: event.target.value as Relationship,
                    })
                  }
                  value={activeResident.relationship}
                >
                  <option value="">Selecciona una opción</option>
                  {RELATIONSHIP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {activeResident.relationship === "owner" ? (
                <label className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                  <input
                    checked={activeResident.isOwnerReference}
                    className="mt-1 h-4 w-4 rounded border-slate-300 accent-[#5b21b6]"
                    name={`resident-${activeResident.id}-owner-reference`}
                    onChange={(event) =>
                      setOwnerReference(activeResident.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>Marcar como propietario de referencia de esta vivienda.</span>
                </label>
              ) : null}

              {errors[activeResident.id]?.ownerReference ? (
                <p
                  className="text-sm leading-5 text-amber-700"
                  id={getErrorId(activeResident.id, "ownerReference")}
                >
                  {errors[activeResident.id]?.ownerReference}
                </p>
              ) : null}

              <label className="block" htmlFor={`resident-${activeResident.id}-phone`}>
                <span className="text-sm font-bold text-slate-950">Teléfono</span>
                <input
                  aria-invalid={errors[activeResident.id]?.phone ? "true" : "false"}
                  aria-describedby={
                    errors[activeResident.id]?.phone
                      ? getErrorId(activeResident.id, "phone")
                      : undefined
                  }
                  autoComplete="tel"
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_rgba(91,33,182,0.10)]"
                  id={`resident-${activeResident.id}-phone`}
                  inputMode="tel"
                  maxLength={PHONE_MAX_LENGTH}
                  name={`resident-${activeResident.id}-phone`}
                  onChange={(event) =>
                    updateResident(activeResident.id, {
                      phone: event.target.value,
                    })
                  }
                  placeholder="Ej. 5555-5555"
                  type="tel"
                  value={activeResident.phone}
                />
                {errors[activeResident.id]?.phone ? (
                  <p
                    className="mt-2 text-sm leading-5 text-amber-700"
                    id={getErrorId(activeResident.id, "phone")}
                  >
                    {errors[activeResident.id]?.phone}
                  </p>
                ) : null}
              </label>

              <label className="block" htmlFor={`resident-${activeResident.id}-email`}>
                <span className="text-sm font-bold text-slate-950">
                  Correo electrónico
                </span>
                <input
                  aria-invalid={errors[activeResident.id]?.email ? "true" : "false"}
                  aria-describedby={
                    errors[activeResident.id]?.email
                      ? getErrorId(activeResident.id, "email")
                      : undefined
                  }
                  autoComplete="email"
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_rgba(91,33,182,0.10)]"
                  id={`resident-${activeResident.id}-email`}
                  inputMode="email"
                  maxLength={EMAIL_MAX_LENGTH}
                  name={`resident-${activeResident.id}-email`}
                  onChange={(event) =>
                    updateResident(activeResident.id, {
                      email: event.target.value,
                    })
                  }
                  placeholder="Ej. ana@correo.com"
                  type="email"
                  value={activeResident.email}
                />
                {errors[activeResident.id]?.email ? (
                  <p
                    className="mt-2 text-sm leading-5 text-amber-700"
                    id={getErrorId(activeResident.id, "email")}
                  >
                    {errors[activeResident.id]?.email}
                  </p>
                ) : null}
              </label>

              {errors[activeResident.id]?.duplicate ? (
                <p
                  className="text-sm leading-5 text-amber-700"
                  id={getErrorId(activeResident.id, "duplicate")}
                >
                  {errors[activeResident.id]?.duplicate}
                </p>
              ) : null}

              <button
                className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#4c1d95] px-5 text-base font-bold text-white shadow-[0_16px_34px_rgba(76,29,149,0.24)] transition hover:bg-[#5b21b6]"
                type="submit"
              >
                Guardar residente
              </button>
            </form>
          ) : null}

          <div aria-live="polite">
            {draftNotice ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                {draftNotice}
              </p>
            ) : null}
            {isAtLimit ? (
              <p className="mt-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm leading-6 text-slate-500 shadow-sm">
                Has alcanzado el máximo de {residentLimit} residentes.
              </p>
            ) : null}
          </div>

          <div className="grid gap-3">
            {savedResidents.length > 0 && !activeResident ? (
              <button
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#5b21b6] bg-white px-4 text-base font-bold text-[#4c1d95] transition hover:bg-[#f7f2ff]"
                disabled={isAtLimit}
                onClick={addResident}
                type="button"
              >
                <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M12 5v14m-7-7h14"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                Agregar otro residente
              </button>
            ) : null}
            <button
              className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#4c1d95] px-5 text-base font-bold text-white shadow-[0_16px_34px_rgba(76,29,149,0.24)] transition hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={savedResidents.length < MIN_RESIDENTS || activeResidentId !== null}
              onClick={handleReview}
              type="button"
            >
              Continuar a revisión
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
