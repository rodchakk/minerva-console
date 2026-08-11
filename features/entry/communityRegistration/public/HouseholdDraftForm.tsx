"use client";

import { useMemo, useState, type FormEvent } from "react";
import { buildHouseholdSubmissionResidents } from "./submissionPayload";

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
      residentErrors.phone = "Revisa el numero de telefono.";
    }

    if (resident.isOwnerReference) {
      ownerReferenceCount += 1;
      if (resident.relationship !== "owner") {
        residentErrors.ownerReference =
          "La referencia de propietario debe tener relacion Propietario.";
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

function joinErrorIds(residentId: number, errors?: ResidentErrors) {
  if (!errors) return undefined;

  return (Object.keys(errors) as Array<keyof ResidentErrors>)
    .map((field) => getErrorId(residentId, field))
    .join(" ");
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
      : [createResidentDraft(1)];
  const [nextResidentId, setNextResidentId] = useState(initialDrafts.length + 1);
  const [residents, setResidents] = useState<ResidentDraft[]>(initialDrafts);
  const [errors, setErrors] = useState<Record<number, ResidentErrors>>({});
  const [reviewResidents, setReviewResidents] = useState<ValidResidentDraft[]>(
    [],
  );
  const [submitError, setSubmitError] = useState<
    "access_unavailable" | "try_again" | "unavailable" | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"edit" | "review" | "success">("edit");
  const [confirmingUnitChange, setConfirmingUnitChange] = useState(false);

  const isAtLimit = residents.length >= residentLimit;
  const canRemoveResident = residents.length > MIN_RESIDENTS;
  const hasDraftContent = useMemo(
    () => residents.some((resident) => hasResidentContent(resident)),
    [residents],
  );
  const isCorrectionSubmit = finalAction === "correction-submit";

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
    setSubmitError(null);
  }

  function addResident() {
    if (isAtLimit) return;

    setResidents((current) => [...current, createResidentDraft(nextResidentId)]);
    setNextResidentId((current) => current + 1);
    setStep("edit");
    setSubmitError(null);
  }

  function removeResident(residentId: number) {
    if (!canRemoveResident) return;

    setResidents((current) =>
      current.filter((resident) => resident.id !== residentId),
    );
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[residentId];
      return nextErrors;
    });
    setStep("edit");
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

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = validateResidents(residents);
    setErrors(result.errors);

    if (Object.keys(result.errors).length > 0) {
      setStep("edit");
      return;
    }

    setReviewResidents(result.validResidents);
    setSubmitError(null);
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
            error?: "access_unavailable" | "try_again" | "unavailable";
            submitted?: boolean;
          }
        | null;

      if (response.ok && result?.submitted === true) {
        setResidents([createResidentDraft(1)]);
        setNextResidentId(2);
        setReviewResidents([]);
        setErrors({});
        setStep("success");
        return;
      }

      if (result?.error === "access_unavailable") {
        setSubmitError("access_unavailable");
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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
          Vivienda
        </p>
        <p className="mt-2 text-lg font-semibold text-white">{unitLabel}</p>
        <p className="mt-2 text-sm leading-6 text-emerald-50/80">
          Puedes registrar hasta {residentLimit} residentes.
        </p>
        {onChangeUnit ? (
          <button
            className="mt-3 text-sm font-semibold text-emerald-50 underline decoration-emerald-200/50 underline-offset-4 transition hover:text-white"
            onClick={requestUnitChange}
            type="button"
          >
            Cambiar vivienda
          </button>
        ) : null}
      </div>

      {confirmingUnitChange && onChangeUnit ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-4">
          <p className="text-sm font-semibold text-amber-100">
            Cambiar vivienda borrara este borrador.
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-50/80">
            Para evitar asociar residentes a otra vivienda, la informacion local
            se limpiara antes de buscar una nueva casa.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.07]"
              onClick={() => setConfirmingUnitChange(false)}
              type="button"
            >
              Conservar vivienda
            </button>
            <button
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-amber-200/30 bg-amber-500/20 px-4 text-sm font-semibold text-amber-50 transition hover:bg-amber-500/28"
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
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4">
            <h2
              className="text-xl font-semibold text-white"
              id="household-success-title"
            >
              {isCorrectionSubmit ? "Cambios enviados" : "Registro enviado"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">
              {isCorrectionSubmit
                ? "Tu informacion actualizada fue enviada correctamente."
                : "Tu informacion fue enviada correctamente a la administracion de tu residencial."}
            </p>
          </div>
        </section>
      ) : step === "review" ? (
        <section className="space-y-5" aria-labelledby="household-review-title">
          <div>
            <h2
              className="text-xl font-semibold text-white"
              id="household-review-title"
            >
              Revisar informacion
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Revisa el borrador local antes del siguiente paso.
            </p>
          </div>

          <div className="space-y-3">
            {reviewResidents.map((resident) => (
              <article
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4"
                key={resident.id}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Residente {resident.position}
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {resident.normalizedFullName}
                </p>
                <dl className="mt-3 grid gap-2 text-sm leading-6 text-slate-200">
                  <div>
                    <dt className="font-semibold text-slate-100">Relacion</dt>
                    <dd>
                      {RELATIONSHIP_LABELS[resident.relationship || "unknown"]}
                      {resident.isOwnerReference
                        ? " - propietario de referencia"
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-100">Telefono</dt>
                    <dd>{resident.normalizedPhone || "No indicado"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-100">Correo</dt>
                    <dd>{resident.normalizedEmail || "No indicado"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4">
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              {finalAction === "local-review"
                ? "Los cambios podran enviarse en el siguiente paso. Esta revision local todavia no actualiza el registro."
                : isCorrectionSubmit
                  ? "Al enviar estos cambios, la informacion actualizada se compartira con la administracion de tu residencial para su revision."
                : "Al enviar este registro, la informacion de residentes se compartira con la administracion de tu residencial para su revision."}
            </p>
          </div>

          <div aria-live="polite">
            {submitError ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-4">
                <p className="text-sm font-semibold text-amber-100">
                  {isCorrectionSubmit
                    ? "No pudimos enviar los cambios"
                    : "No pudimos enviar el registro"}
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-50/80">
                  {submitError === "access_unavailable"
                    ? "Este enlace de correccion ya no esta disponible."
                    : submitError === "unavailable"
                    ? "No pudimos completar el registro. Verifica el enlace o comunicate con la administracion."
                    : isCorrectionSubmit
                      ? "No pudimos confirmar si los cambios se guardaron. No se reintentara automaticamente; actualiza o abre de nuevo el enlace oficial para verificar si sigue disponible antes de intentarlo otra vez."
                    : "No pudimos confirmar si el registro se guardo. No se reintentara automaticamente; verifica con la administracion antes de enviarlo otra vez."}
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              onClick={() => {
                setSubmitError(null);
                setStep("edit");
              }}
              type="button"
            >
              Editar informacion
            </button>
            <button
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-violet-300/25 bg-violet-500/20 px-4 text-sm font-semibold text-white transition hover:border-violet-200/40 hover:bg-violet-500/28 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={finalAction === "local-review" || isSubmitting}
              onClick={
                finalAction === "local-review" ? undefined : handleFinalSubmit
              }
              type="button"
            >
              {finalAction === "local-review"
                ? "Envio disponible en el siguiente paso"
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
        <form className="space-y-5" noValidate onSubmit={handleReview}>
          <div>
            <h2 className="text-xl font-semibold text-white">
              Residentes de la vivienda
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              {introText ??
                "Agrega la informacion de las personas que viven en esta casa. El borrador se mantiene solo en esta pantalla."}
            </p>
          </div>

          <div className="space-y-4">
            {residents.map((resident, index) => {
              const residentErrors = errors[resident.id];
              const describedBy = joinErrorIds(resident.id, residentErrors);
              const isOwner = resident.relationship === "owner";

              return (
                <fieldset
                  aria-describedby={describedBy}
                  className="space-y-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4"
                  key={resident.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <legend className="text-base font-semibold text-white">
                      Residente {index + 1}
                    </legend>
                    <button
                      className="text-sm font-semibold text-slate-300 underline decoration-slate-400/50 underline-offset-4 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={!canRemoveResident}
                      onClick={() => removeResident(resident.id)}
                      type="button"
                    >
                      Quitar
                    </button>
                  </div>

                  <label className="block" htmlFor={`resident-${resident.id}-name`}>
                    <span className="text-sm font-semibold text-slate-100">
                      Nombre completo
                    </span>
                    <input
                      aria-invalid={residentErrors?.fullName ? "true" : "false"}
                      aria-describedby={
                        residentErrors?.fullName
                          ? getErrorId(resident.id, "fullName")
                          : undefined
                      }
                      autoComplete="name"
                      className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300/50 focus:bg-white/[0.06]"
                      id={`resident-${resident.id}-name`}
                      maxLength={NAME_MAX_LENGTH}
                      name={`resident-${resident.id}-name`}
                      onChange={(event) =>
                        updateResident(resident.id, {
                          fullName: event.target.value,
                        })
                      }
                      placeholder="Ej. Ana Martinez"
                      required
                      type="text"
                      value={resident.fullName}
                    />
                    {residentErrors?.fullName ? (
                      <p
                        className="mt-2 text-sm leading-5 text-amber-100"
                        id={getErrorId(resident.id, "fullName")}
                      >
                        {residentErrors.fullName}
                      </p>
                    ) : null}
                  </label>

                  <label
                    className="block"
                    htmlFor={`resident-${resident.id}-relationship`}
                  >
                    <span className="text-sm font-semibold text-slate-100">
                      Relacion con la vivienda
                    </span>
                    <select
                      className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#111827] px-4 text-base text-white outline-none transition focus:border-violet-300/50 focus:bg-[#151f2f]"
                      id={`resident-${resident.id}-relationship`}
                      name={`resident-${resident.id}-relationship`}
                      onChange={(event) =>
                        updateResident(resident.id, {
                          relationship: event.target.value as Relationship,
                        })
                      }
                      value={resident.relationship}
                    >
                      <option value="">Selecciona una opcion</option>
                      {RELATIONSHIP_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {isOwner ? (
                    <label className="flex gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-sm leading-6 text-slate-100">
                      <input
                        checked={resident.isOwnerReference}
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-violet-300"
                        name={`resident-${resident.id}-owner-reference`}
                        onChange={(event) =>
                          setOwnerReference(resident.id, event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>
                        Marcar como propietario de referencia de esta vivienda.
                      </span>
                    </label>
                  ) : null}

                  {residentErrors?.ownerReference ? (
                    <p
                      className="text-sm leading-5 text-amber-100"
                      id={getErrorId(resident.id, "ownerReference")}
                    >
                      {residentErrors.ownerReference}
                    </p>
                  ) : null}

                  <label className="block" htmlFor={`resident-${resident.id}-phone`}>
                    <span className="text-sm font-semibold text-slate-100">
                      Telefono
                    </span>
                    <input
                      aria-invalid={residentErrors?.phone ? "true" : "false"}
                      aria-describedby={
                        residentErrors?.phone
                          ? getErrorId(resident.id, "phone")
                          : undefined
                      }
                      autoComplete="tel"
                      className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300/50 focus:bg-white/[0.06]"
                      id={`resident-${resident.id}-phone`}
                      inputMode="tel"
                      maxLength={PHONE_MAX_LENGTH}
                      name={`resident-${resident.id}-phone`}
                      onChange={(event) =>
                        updateResident(resident.id, {
                          phone: event.target.value,
                        })
                      }
                      placeholder="Ej. 5555-5555"
                      type="tel"
                      value={resident.phone}
                    />
                    {residentErrors?.phone ? (
                      <p
                        className="mt-2 text-sm leading-5 text-amber-100"
                        id={getErrorId(resident.id, "phone")}
                      >
                        {residentErrors.phone}
                      </p>
                    ) : null}
                  </label>

                  <label className="block" htmlFor={`resident-${resident.id}-email`}>
                    <span className="text-sm font-semibold text-slate-100">
                      Correo electronico
                    </span>
                    <input
                      aria-invalid={residentErrors?.email ? "true" : "false"}
                      aria-describedby={
                        residentErrors?.email
                          ? getErrorId(resident.id, "email")
                          : undefined
                      }
                      autoComplete="email"
                      className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300/50 focus:bg-white/[0.06]"
                      id={`resident-${resident.id}-email`}
                      inputMode="email"
                      maxLength={EMAIL_MAX_LENGTH}
                      name={`resident-${resident.id}-email`}
                      onChange={(event) =>
                        updateResident(resident.id, {
                          email: event.target.value,
                        })
                      }
                      placeholder="Ej. ana@correo.com"
                      type="email"
                      value={resident.email}
                    />
                    {residentErrors?.email ? (
                      <p
                        className="mt-2 text-sm leading-5 text-amber-100"
                        id={getErrorId(resident.id, "email")}
                      >
                        {residentErrors.email}
                      </p>
                    ) : null}
                  </label>

                  {residentErrors?.duplicate ? (
                    <p
                      className="text-sm leading-5 text-amber-100"
                      id={getErrorId(resident.id, "duplicate")}
                    >
                      {residentErrors.duplicate}
                    </p>
                  ) : null}
                </fieldset>
              );
            })}
          </div>

          <div aria-live="polite">
            {isAtLimit ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
                Has alcanzado el maximo de {residentLimit} residentes.
              </p>
            ) : (
              <button
                className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.07]"
                onClick={addResident}
                type="button"
              >
                Agregar residente
              </button>
            )}
          </div>

          <button
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-violet-300/25 bg-violet-500/20 px-4 text-sm font-semibold text-white transition hover:border-violet-200/40 hover:bg-violet-500/28"
            type="submit"
          >
            Revisar informacion
          </button>
        </form>
      )}
    </div>
  );
}
