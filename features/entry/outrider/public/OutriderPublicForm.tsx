"use client";

import {
  AlertCircle,
  Check,
  FileUp,
  Loader2,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  OUTRIDER_PUBLIC_UPLOAD_CATEGORIES,
  OUTRIDER_STORAGE_BUCKET,
  calculateOutriderCompletedSections,
  getOutriderProgressPercent,
  getOutriderUnitTypeLabel,
  isOutriderEditable,
  type OutriderAdministrator,
  type OutriderContact,
  type OutriderDraft,
  type OutriderFileRecord,
  type OutriderPublicUploadCategory,
  type OutriderSection,
  type OutriderStatus,
  type OutriderUnitType,
  type PublicOutriderSession,
} from "@/features/entry/outrider/model";

type OutriderPublicFormProps = {
  session: PublicOutriderSession;
  token: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const CATEGORY_COPY: Record<
  OutriderPublicUploadCategory,
  { label: string; note: string }
> = {
  community_data: {
    label: "Archivo de información de la comunidad",
    note: "Puede contener unidades, residentes o ambos. Envíe el archivo que ya utiliza administración.",
  },
};

const EMPTY_ADMIN: OutriderAdministrator = {
  email: null,
  name: null,
  phone: null,
  unit: null,
};

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLocaleLowerCase("es-GT");
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function fileSizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Section({
  children,
  complete,
  index,
  title,
}: {
  children: React.ReactNode;
  complete: boolean;
  index: number;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${
            complete
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200"
          }`}
        >
          {complete ? <Check className="h-4 w-4" /> : index}
        </span>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function OutriderPublicForm({ session, token }: OutriderPublicFormProps) {
  const [draft, setDraft] = useState<OutriderDraft>(session.draft);
  const [completedSections, setCompletedSections] = useState<OutriderSection[]>(
    session.completedSections,
  );
  const [files, setFiles] = useState<OutriderFileRecord[]>(session.files);
  const [status, setStatus] = useState<OutriderStatus>(session.status);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [uploadingCategory, setUploadingCategory] =
    useState<OutriderPublicUploadCategory | null>(null);
  const saveTimer = useRef<number | null>(null);
  const dirty = useRef(false);
  const editable = isOutriderEditable(status);
  const progress = getOutriderProgressPercent(completedSections);
  const computedSections = useMemo(
    () => calculateOutriderCompletedSections(draft, completedSections),
    [completedSections, draft],
  );

  const save = useCallback(
    async (extraSections: OutriderSection[] = []) => {
      if (!editable) return true;

      const markSectionsComplete = Array.from(
        new Set([...completedSections, ...computedSections, ...extraSections]),
      );
      setSaveState("saving");
      setError(null);

      try {
        const response = await fetch(`/entry/outrider/${encodeURIComponent(token)}/save`, {
          body: JSON.stringify({ ...draft, markSectionsComplete }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const body = (await response.json()) as {
          completedSections?: OutriderSection[];
          message?: string;
          status?: OutriderStatus;
        };

        if (!response.ok) {
          throw new Error(body.message || "No pudimos guardar los cambios.");
        }

        setCompletedSections(body.completedSections ?? markSectionsComplete);
        if (body.status) setStatus(body.status);
        dirty.current = false;
        setSaveState("saved");
        return true;
      } catch (caught) {
        setSaveState("error");
        setError(
          caught instanceof Error
            ? caught.message
            : "No pudimos guardar los cambios.",
        );
        return false;
      }
    },
    [completedSections, computedSections, draft, editable, token],
  );

  useEffect(() => {
    if (!editable || !dirty.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    saveTimer.current = window.setTimeout(() => {
      void save();
    }, 900);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [draft, editable, save]);

  function updateDraft(update: Partial<OutriderDraft>) {
    dirty.current = true;
    setDraft((current) => ({ ...current, ...update }));
    setSaveState("idle");
  }

  function toggleUnitType(unitType: OutriderUnitType) {
    const current = new Set(draft.unitTypes);
    if (current.has(unitType)) {
      current.delete(unitType);
      if (unitType === "otro") {
        updateDraft({ otherUnitType: null, unitTypes: Array.from(current) });
        return;
      }
    } else {
      current.add(unitType);
    }
    updateDraft({ unitTypes: Array.from(current) });
  }

  function updateDestination(index: number, value: string) {
    const next = [...draft.destinationNames];
    next[index] = value;
    updateDraft({ destinationNames: next });
  }

  function updateEstablishment(index: number, value: string) {
    const next = [...(draft.establishmentNames ?? [])];
    next[index] = value;
    updateDraft({ establishmentNames: next });
  }

  function updateSecurityStaffName(index: number, value: string) {
    const next = [...(draft.securityStaffNames ?? [])];
    next[index] = value;
    updateDraft({ securityStaffNames: next });
  }

  function updateInactiveUnit(index: number, value: string) {
    const raw = draft.inactiveUnitNotes
      ? draft.inactiveUnitNotes.split(/,\s*/)
      : [""];
    const list = raw.length > 0 ? raw : [""];
    list[index] = value;
    updateDraft({ inactiveUnitNotes: list.join(", ") });
  }

  function setInitialAdminCount(raw: string) {
    if (raw === "") {
      updateDraft({ initialAdminCount: null, initialAdmins: [] });
      return;
    }

    const count = Math.min(25, Math.max(0, Number(raw)));
    if (!Number.isInteger(count)) return;

    const initialAdmins = Array.from({ length: count }, (_, index) =>
      draft.initialAdmins[index]
        ? { ...draft.initialAdmins[index] }
        : { ...EMPTY_ADMIN },
    );
    updateDraft({ initialAdminCount: count, initialAdmins });
  }

  function updateAdministrator(
    index: number,
    field: keyof OutriderAdministrator,
    value: string,
  ) {
    const initialAdmins = draft.initialAdmins.map((administrator, currentIndex) =>
      currentIndex === index
        ? { ...administrator, [field]: value }
        : administrator,
    );
    updateDraft({ initialAdmins });
  }

  const contactsList: OutriderContact[] = useMemo(() => {
    if (draft.contacts && draft.contacts.length > 0) {
      return draft.contacts;
    }
    if (draft.contactName || draft.contactPhone || draft.contactEmail) {
      return [
        {
          email: draft.contactEmail,
          name: draft.contactName,
          phone: draft.contactPhone,
        },
      ];
    }
    return [{ email: null, name: null, phone: null }];
  }, [draft.contacts, draft.contactName, draft.contactPhone, draft.contactEmail]);

  function updateContact(
    index: number,
    field: keyof OutriderContact,
    value: string,
  ) {
    const nextContacts = contactsList.map((c, i) =>
      i === index ? { ...c, [field]: value || null } : c,
    );
    const primary = nextContacts[0] ?? { email: null, name: null, phone: null };
    updateDraft({
      contactEmail: primary.email,
      contactName: primary.name,
      contactPhone: primary.phone,
      contacts: nextContacts,
    });
  }

  function addContact() {
    if (contactsList.length >= 3) return;
    const nextContacts = [...contactsList, { email: null, name: null, phone: null }];
    const primary = nextContacts[0] ?? { email: null, name: null, phone: null };
    updateDraft({
      contactEmail: primary.email,
      contactName: primary.name,
      contactPhone: primary.phone,
      contacts: nextContacts,
    });
  }

  function removeContact(index: number) {
    if (contactsList.length <= 1) return;
    const nextContacts = contactsList.filter((_, i) => i !== index);
    const primary = nextContacts[0] ?? { email: null, name: null, phone: null };
    updateDraft({
      contactEmail: primary.email,
      contactName: primary.name,
      contactPhone: primary.phone,
      contacts: nextContacts,
    });
  }

  async function submitForReview() {
    const saved = await save(computedSections);
    if (!saved) return;

    setSaveState("saving");
    setError(null);

    try {
      const response = await fetch(
        `/entry/outrider/${encodeURIComponent(token)}/submit`,
        { method: "POST" },
      );
      const body = (await response.json()) as {
        completedSections?: OutriderSection[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(body.message || "No pudimos enviar la información.");
      }

      setCompletedSections(body.completedSections ?? completedSections);
      setStatus("ready_for_review");
      setSaveState("saved");
    } catch (caught) {
      setSaveState("error");
      setError(
        caught instanceof Error
          ? caught.message
          : "No pudimos enviar la información.",
      );
    }
  }

  async function uploadFile(category: OutriderPublicUploadCategory, file: File) {
    if (!editable) return;

    setUploadingCategory(category);
    setError(null);

    try {
      const startResponse = await fetch(
        `/entry/outrider/${encodeURIComponent(token)}/upload/start`,
        {
          body: JSON.stringify({
            byteSize: file.size,
            category,
            mimeType: file.type,
            originalFilename: file.name,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const startBody = (await startResponse.json()) as {
        message?: string;
        path?: string;
        signedToken?: string;
      };

      if (!startResponse.ok || !startBody.path || !startBody.signedToken) {
        throw new Error(startBody.message || "No pudimos preparar la carga.");
      }

      const supabase = createClient();
      const uploadResult = await supabase.storage
        .from(OUTRIDER_STORAGE_BUCKET)
        .uploadToSignedUrl(startBody.path, startBody.signedToken, file, {
          contentType: file.type,
        });

      if (uploadResult.error) throw new Error(uploadResult.error.message);

      const completeResponse = await fetch(
        `/entry/outrider/${encodeURIComponent(token)}/upload/complete`,
        {
          body: JSON.stringify({
            byteSize: file.size,
            category,
            mimeType: file.type,
            originalFilename: file.name,
            storagePath: startBody.path,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const completeBody = (await completeResponse.json()) as {
        file?: OutriderFileRecord;
        message?: string;
      };

      if (!completeResponse.ok || !completeBody.file) {
        throw new Error(completeBody.message || "No pudimos registrar el archivo.");
      }

      setFiles((current) => [completeBody.file!, ...current]);
      updateDraft({
        availableInformation: uniqueStrings([
          ...draft.availableInformation,
          category,
        ]) as OutriderDraft["availableInformation"],
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No pudimos cargar el archivo.",
      );
      setSaveState("error");
    } finally {
      setUploadingCategory(null);
    }
  }

  const saveLabel =
    saveState === "saving"
      ? "Guardando..."
      : saveState === "error"
        ? "Error al guardar"
        : "Cambios guardados";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-8">
        <header className="rounded-lg border border-slate-200 bg-white px-4 py-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
            ENTRY
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Preparación de {session.communityName}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Esta información nos ayudará a preparar ENTRY para su comunidad.
            Puede completarla poco a poco. Sus cambios se guardarán automáticamente.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-violet-700 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-slate-700">
              {progress}% completo
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
            {saveState === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveState === "error" ? (
              <AlertCircle className="h-4 w-4 text-rose-600" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            <span>{saveLabel}</span>
          </div>
        </header>

        {!editable ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            {status === "ready_for_review"
              ? "Su información fue enviada para revisión. Minerva le avisará si necesita algún cambio."
              : "Esta preparación ya fue aprobada. La información queda en modo solo lectura."}
          </div>
        ) : null}

        {session.reviewNote && editable ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            <p className="font-semibold">Solicitud de información</p>
            <p className="mt-1">{session.reviewNote}</p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void save()}
              className="mt-2 inline-flex h-9 items-center gap-2 rounded-md bg-rose-700 px-3 text-sm font-semibold text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Reintentar guardado
            </button>
          </div>
        ) : null}

        <Section
          complete={completedSections.includes("units")}
          index={1}
          title="Unidades"
        >
          <fieldset disabled={!editable} className="space-y-3">
            <legend className="text-sm font-semibold text-slate-800">
              ¿Qué tipos de unidades existen en la comunidad?
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  "casas",
                  "apartamentos",
                  "condominios",
                  "oficinas",
                  "otro",
                ] as const
              ).map((unitType) => (
                <label
                  key={unitType}
                  className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={draft.unitTypes.includes(unitType)}
                    onChange={() => toggleUnitType(unitType)}
                  />
                  <span>{getOutriderUnitTypeLabel(unitType)}</span>
                </label>
              ))}
            </div>

            {draft.unitTypes.includes("otro") ? (
              <div className="pt-2">
                <label className="text-xs font-semibold text-slate-700">
                  Especifica el otro tipo de unidad
                </label>
                <input
                  type="text"
                  disabled={!editable}
                  value={draft.otherUnitType ?? ""}
                  onChange={(e) => updateDraft({ otherUnitType: e.target.value })}
                  placeholder="Ej. Locales comerciales, Lotes, Bodegas..."
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            ) : null}
          </fieldset>
        </Section>

        <Section
          complete={completedSections.includes("destinations")}
          index={2}
          title="Establecimientos y áreas comunes"
        >
          <div className="space-y-5">
            <div>
              <fieldset disabled={!editable} className="space-y-2">
                <legend className="text-sm font-semibold text-slate-800">
                  ¿Existen establecimientos comerciales o empresas dentro de la residencial?
                </legend>
                <p className="text-sm leading-6 text-slate-600">
                  Por ejemplo: tiendas, oficinas comerciales, restaurantes, bodegas o empresas operando dentro de la comunidad.
                </p>
                <div className="mt-2 flex gap-2">
                  {[true, false].map((value) => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() =>
                        updateDraft({
                          establishmentNames: value ? (draft.establishmentNames ?? []) : [],
                          hasEstablishments: value,
                        })
                      }
                      className={`h-10 rounded-md border px-4 text-sm font-semibold ${
                        draft.hasEstablishments === value
                          ? "border-violet-700 bg-violet-700 text-white"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      {value ? "Sí" : "No"}
                    </button>
                  ))}
                </div>
              </fieldset>

              {draft.hasEstablishments ? (
                <div className="mt-3 space-y-2">
                  {((draft.establishmentNames ?? []).length > 0
                    ? draft.establishmentNames
                    : [""]
                  ).map((establishment, index) => (
                    <input
                      key={index}
                      disabled={!editable}
                      value={establishment}
                      onBlur={() => void save()}
                      onChange={(event) => updateEstablishment(index, event.currentTarget.value)}
                      placeholder={index === 0 ? "Empresa Horizontes" : "Oficina Comercial"}
                      className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600"
                    />
                  ))}
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() =>
                      updateDraft({
                        establishmentNames: [...(draft.establishmentNames ?? []), ""],
                      })
                    }
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar otro establecimiento
                  </button>
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <fieldset disabled={!editable} className="space-y-2">
                <legend className="text-sm font-semibold text-slate-800">
                  ¿Existen áreas comunes o recreativas como destinos en ENTRY?
                </legend>
                <p className="text-sm leading-6 text-slate-600">
                  Áreas que los vecinos o la administración puedan reservar dentro de la comunidad, como canchas de fútbol, casa club, área de piscina, parque o salones de eventos.
                </p>
                <div className="mt-2 flex gap-2">
                  {[true, false].map((value) => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() =>
                        updateDraft({
                          destinationNames: value ? draft.destinationNames : [],
                          hasDestinations: value,
                        })
                      }
                      className={`h-10 rounded-md border px-4 text-sm font-semibold ${
                        draft.hasDestinations === value
                          ? "border-violet-700 bg-violet-700 text-white"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      {value ? "Sí" : "No"}
                    </button>
                  ))}
                </div>
              </fieldset>

              {draft.hasDestinations ? (
                <div className="mt-3 space-y-2">
                  {(draft.destinationNames.length > 0 ? draft.destinationNames : [""]).map(
                    (destination, index) => (
                      <input
                        key={index}
                        disabled={!editable}
                        value={destination}
                        onBlur={() => void save()}
                        onChange={(event) =>
                          updateDestination(index, event.currentTarget.value)
                        }
                        placeholder={
                          index === 0 ? "Cancha de fútbol" : "Casa Club"
                        }
                        className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600"
                      />
                    ),
                  )}
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() =>
                      updateDraft({
                        destinationNames: [...draft.destinationNames, ""],
                      })
                    }
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar otro área / destino
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </Section>

        <Section
          complete={completedSections.includes("available_information")}
          index={3}
          title="Información disponible"
        >
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-sm font-semibold text-slate-900">Personal de seguridad</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Indíquenos cuántas personas forman parte del personal de seguridad (1–8) y opcionalmente sus nombres.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Cantidad de personal de seguridad
                </span>
                <select
                  disabled={!editable}
                  value={draft.securityStaffCount ?? ""}
                  onChange={(event) => {
                    const val = event.currentTarget.value ? Number(event.currentTarget.value) : null;
                    updateDraft({ securityStaffCount: val });
                  }}
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600"
                >
                  <option value="">Seleccionar (1 - 8)</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? "persona" : "personas"}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sm:col-span-2 space-y-2">
                <span className="text-sm font-medium text-slate-700">Nombres del personal (opcional)</span>
                {((draft.securityStaffNames ?? []).length > 0
                  ? draft.securityStaffNames
                  : [""]
                ).map((name, index) => (
                  <input
                    key={index}
                    disabled={!editable}
                    value={name}
                    onBlur={() => void save()}
                    onChange={(event) => updateSecurityStaffName(index, event.currentTarget.value)}
                    placeholder={`Guardia ${index + 1}`}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600"
                  />
                ))}
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() =>
                    updateDraft({
                      securityStaffNames: [...(draft.securityStaffNames ?? []), ""],
                    })
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700"
                >
                  <Plus className="h-4 w-4" />
                  Agregar personal
                </button>
              </div>
            </div>
          </div>

          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-900">
            No necesita reorganizar la información para nosotros. Si ya tiene un
            archivo con unidades, residentes o ambos, envíelo tal como lo utiliza
            y Minerva se encargará de prepararlo para ENTRY. El archivo es opcional.
          </p>
          <div className="space-y-3">
            {OUTRIDER_PUBLIC_UPLOAD_CATEGORIES.map((category) => (
              <div
                key={category}
                className="rounded-md border border-slate-200 px-3 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {CATEGORY_COPY[category].label}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {CATEGORY_COPY[category].note}
                    </p>
                  </div>
                  {files.length === 0 ? (
                    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">
                      {uploadingCategory === category ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileUp className="h-4 w-4" />
                      )}
                      Cargar archivo
                      <input
                        type="file"
                        disabled={!editable || uploadingCategory !== null}
                        accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.png,.jpg,.jpeg"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = "";
                          if (file) void uploadFile(category, file);
                        }}
                      />
                    </label>
                  ) : (
                    <span className="inline-flex h-9 items-center rounded-md bg-emerald-50 px-3 text-xs font-semibold text-emerald-800">
                      Archivo recibido
                    </span>
                  )}
                </div>
                {files.length > 0 ? (
                  <div className="mt-3 space-y-1">
                    {files.map((file) => (
                      <p key={file.id} className="text-xs text-slate-600">
                        {file.originalFilename} · {fileSizeLabel(file.byteSize)}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Section>

        <Section
          complete={completedSections.includes("inactive_units")}
          index={4}
          title="Unidades desactivadas"
        >
          <fieldset disabled={!editable} className="space-y-3">
            <legend className="text-sm font-semibold text-slate-800">
              ¿Hay unidades que no deben comenzar activas al momento de iniciar ENTRY?
            </legend>
            <div className="flex gap-2">
              {[true, false].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() =>
                    updateDraft({
                      hasInactiveUnits: value,
                      inactiveUnitNotes: value ? draft.inactiveUnitNotes : null,
                    })
                  }
                  className={`h-10 rounded-md border px-4 text-sm font-semibold ${
                    draft.hasInactiveUnits === value
                      ? "border-violet-700 bg-violet-700 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {value ? "Sí" : "No"}
                </button>
              ))}
            </div>
          </fieldset>

          {draft.hasInactiveUnits ? (
            <div className="mt-3 space-y-2">
              {(
                draft.inactiveUnitNotes
                  ? draft.inactiveUnitNotes.split(/,\s*/).length > 0
                    ? draft.inactiveUnitNotes.split(/,\s*/)
                    : [""]
                  : [""]
              ).map((unitName, index) => (
                <input
                  key={index}
                  disabled={!editable}
                  value={unitName}
                  onBlur={() => void save()}
                  onChange={(event) =>
                    updateInactiveUnit(index, event.currentTarget.value)
                  }
                  placeholder={index === 0 ? "Casa 14" : "Apartamento 203"}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600"
                />
              ))}
              <button
                type="button"
                disabled={!editable}
                onClick={() => {
                  const current = draft.inactiveUnitNotes
                    ? draft.inactiveUnitNotes.split(/,\s*/)
                    : [""];
                  updateDraft({
                    inactiveUnitNotes: [...current, ""].join(", "),
                  });
                }}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700"
              >
                <Plus className="h-4 w-4" />
                Agregar otra unidad desactivada
              </button>
            </div>
          ) : null}
        </Section>

        <Section
          complete={completedSections.includes("contact")}
          index={5}
          title="Contacto y administradores"
        >
          <div>
            <p className="text-sm font-semibold text-slate-900">Contacto principal</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Personas con quienes confirmaremos cualquier duda durante la configuración (máximo 3).
            </p>
            <div className="mt-3 space-y-4">
              {contactsList.map((contact, index) => (
                <div
                  key={index}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      Contacto {index + 1} {index === 0 ? "(Principal)" : ""}
                    </p>
                    {contactsList.length > 1 && editable ? (
                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        className="text-xs text-rose-600 hover:underline font-medium"
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="text-sm font-semibold text-slate-800">Nombre completo</span>
                      <input
                        disabled={!editable}
                        value={contact.name ?? ""}
                        onBlur={() => void save()}
                        onChange={(event) =>
                          updateContact(index, "name", event.currentTarget.value)
                        }
                        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-600"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">Teléfono</span>
                      <input
                        disabled={!editable}
                        value={contact.phone ?? ""}
                        onBlur={() => void save()}
                        onChange={(event) =>
                          updateContact(index, "phone", event.currentTarget.value)
                        }
                        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-600"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">
                        Correo electrónico
                      </span>
                      <input
                        disabled={!editable}
                        type="email"
                        value={contact.email ?? ""}
                        onBlur={() => void save()}
                        onChange={(event) =>
                          updateContact(index, "email", event.currentTarget.value)
                        }
                        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-600"
                      />
                    </label>
                  </div>
                </div>
              ))}

              {contactsList.length < 3 && editable ? (
                <button
                  type="button"
                  onClick={addContact}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700"
                >
                  <Plus className="h-4 w-4" />
                  Agregar contacto
                </button>
              ) : null}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-900">
              Administradores iniciales de ENTRY
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Queremos preparar primero las activaciones de las personas que
              administrarán la comunidad. Puede repetir al contacto principal si
              también será administrador.
            </p>
            <label className="mt-3 block max-w-xs">
              <span className="text-sm font-semibold text-slate-800">
                ¿Cuántos administradores habrá al iniciar?
              </span>
              <select
                disabled={!editable}
                value={draft.initialAdminCount ?? ""}
                onChange={(event) => {
                  setInitialAdminCount(event.currentTarget.value);
                  void save();
                }}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600"
              >
                <option value="">Seleccionar cantidad</option>
                {Array.from({ length: 11 }, (_, i) => (
                  <option key={i} value={i}>
                    {i} {i === 1 ? "administrador" : "administradores"}
                  </option>
                ))}
              </select>
            </label>

            {draft.initialAdminCount !== null && draft.initialAdminCount > 0 ? (
              <div className="mt-4 space-y-3">
                {draft.initialAdmins.map((administrator, index) => (
                  <div
                    key={index}
                    className="rounded-md border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      Administrador {index + 1}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="text-sm font-semibold text-slate-800">
                          Nombre completo
                        </span>
                        <input
                          disabled={!editable}
                          value={administrator.name ?? ""}
                          onBlur={() => void save()}
                          onChange={(event) =>
                            updateAdministrator(
                              index,
                              "name",
                              event.currentTarget.value,
                            )
                          }
                          className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-600"
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-sm font-semibold text-slate-800">
                          Casa o unidad
                        </span>
                        <input
                          disabled={!editable}
                          value={administrator.unit ?? ""}
                          placeholder="Casa 01"
                          onBlur={() => void save()}
                          onChange={(event) =>
                            updateAdministrator(
                              index,
                              "unit",
                              event.currentTarget.value,
                            )
                          }
                          className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-600"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-800">
                          Teléfono
                        </span>
                        <input
                          disabled={!editable}
                          value={administrator.phone ?? ""}
                          onBlur={() => void save()}
                          onChange={(event) =>
                            updateAdministrator(
                              index,
                              "phone",
                              event.currentTarget.value,
                            )
                          }
                          className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-600"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-800">
                          Correo electrónico
                        </span>
                        <input
                          disabled={!editable}
                          type="email"
                          value={administrator.email ?? ""}
                          onBlur={() => void save()}
                          onChange={(event) =>
                            updateAdministrator(
                              index,
                              "email",
                              event.currentTarget.value,
                            )
                          }
                          className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-600"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Section>

        <footer className="sticky bottom-0 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {progress}% completo · {editable ? "Puede enviar cuando esté listo." : "Modo solo lectura."}
            </p>
            <button
              type="button"
              disabled={!editable || progress < 100 || saveState === "saving"}
              onClick={() => void submitForReview()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-violet-700 px-4 text-sm font-bold uppercase tracking-[0.08em] text-white disabled:bg-slate-400"
            >
              <Send className="h-4 w-4" />
              Enviar para revisión
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
