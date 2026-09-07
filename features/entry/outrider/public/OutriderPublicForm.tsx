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
  OUTRIDER_FILE_CATEGORIES,
  OUTRIDER_STORAGE_BUCKET,
  calculateOutriderCompletedSections,
  getOutriderProgressPercent,
  getOutriderUnitTypeLabel,
  isOutriderEditable,
  type OutriderDraft,
  type OutriderFileCategory,
  type OutriderFileRecord,
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
  OutriderFileCategory,
  {
    label: string;
    note: string;
  }
> = {
  common_areas: {
    label: "Listado de áreas comunes o recreativas",
    note: "Piscina, cancha, casa club u otros destinos.",
  },
  residents: {
    label: "Listado actual de residentes por unidad",
    note: "Puede ser el archivo que ya usa administracion.",
  },
  security_staff: {
    label: "Listado de personal de seguridad",
    note: "Turnos, nombres o teléfonos si ya los tienen.",
  },
  units: {
    label: "Listado de unidades o numeración de la residencial",
    note: "Casas, apartamentos, oficinas u otra numeración.",
  },
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
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function OutriderPublicForm({
  session,
  token,
}: OutriderPublicFormProps) {
  const [draft, setDraft] = useState<OutriderDraft>(session.draft);
  const [completedSections, setCompletedSections] = useState<OutriderSection[]>(
    session.completedSections,
  );
  const [files, setFiles] = useState<OutriderFileRecord[]>(session.files);
  const [status, setStatus] = useState<OutriderStatus>(session.status);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [uploadingCategory, setUploadingCategory] =
    useState<OutriderFileCategory | null>(null);
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
          body: JSON.stringify({
            ...draft,
            markSectionsComplete,
          }),
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

    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }

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

  async function uploadFile(category: OutriderFileCategory, file: File) {
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

      if (uploadResult.error) {
        throw new Error(uploadResult.error.message);
      }

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
        ]) as OutriderFileCategory[],
      });
      await save(["available_information"]);
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
            Puede completarla poco a poco. Sus cambios se guardarán
            automáticamente.
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
              {(["casas", "apartamentos", "condominios", "oficinas", "otro"] as const).map(
                (unitType) => (
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
                ),
              )}
            </div>
          </fieldset>

          {draft.unitTypes.includes("otro") ? (
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Otro</span>
              <input
                disabled={!editable}
                value={draft.otherUnitType ?? ""}
                onBlur={() => void save()}
                onChange={(event) =>
                  updateDraft({ otherUnitType: event.currentTarget.value })
                }
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600"
              />
            </label>
          ) : null}

          <div>
            <p className="text-sm font-semibold text-slate-800">
              ¿Cómo desean que aparezcan las unidades dentro de ENTRY?
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Ejemplos: Casa 01, Apartamento 201, Condominio A-03, Oficina 4,
              Taller El Trancazo
            </p>
            <label className="mt-3 block">
              <span className="text-sm text-slate-700">
                Ejemplo de cómo identifican actualmente sus unidades
              </span>
              <input
                disabled={!editable}
                value={draft.unitNamingExample ?? ""}
                onBlur={() => void save()}
                onChange={(event) =>
                  updateDraft({ unitNamingExample: event.currentTarget.value })
                }
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600"
              />
            </label>
          </div>
        </Section>

        <Section
          complete={completedSections.includes("destinations")}
          index={2}
          title="Áreas y destinos"
        >
          <fieldset disabled={!editable} className="space-y-3">
            <legend className="text-sm font-semibold text-slate-800">
              ¿Existen áreas comunes, recreativas u otros lugares que deban
              aparecer como destinos en ENTRY?
            </legend>
            <div className="flex gap-2">
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
            <div className="space-y-2">
              {(draft.destinationNames.length > 0
                ? draft.destinationNames
                : [""]
              ).map((destination, index) => (
                <input
                  key={index}
                  disabled={!editable}
                  value={destination}
                  onBlur={() => void save()}
                  onChange={(event) => updateDestination(index, event.currentTarget.value)}
                  placeholder={index === 0 ? "Piscina" : "Casa Club"}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600"
                />
              ))}
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
                Agregar otro destino
              </button>
            </div>
          ) : null}
        </Section>

        <Section
          complete={completedSections.includes("inactive_units")}
          index={3}
          title="Unidades desactivadas"
        >
          <fieldset disabled={!editable} className="space-y-3">
            <legend className="text-sm font-semibold text-slate-800">
              ¿Hay unidades que no deben comenzar activas al momento de iniciar
              ENTRY?
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
            <textarea
              disabled={!editable}
              value={draft.inactiveUnitNotes ?? ""}
              onBlur={() => void save()}
              onChange={(event) =>
                updateDraft({ inactiveUnitNotes: event.currentTarget.value })
              }
              placeholder="Casa 14, Casa 28, Apartamento 203"
              rows={4}
              className="w-full resize-y rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-violet-600"
            />
          ) : null}
        </Section>

        <Section
          complete={completedSections.includes("available_information")}
          index={4}
          title="Información disponible"
        >
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-900">
            No necesita reorganizar la información para nosotros. Envíenos el
            archivo que ya utiliza y Minerva se encargará de prepararlo para
            ENTRY.
          </p>
          <div className="space-y-3">
            {OUTRIDER_FILE_CATEGORIES.map((category) => (
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
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">
                    {uploadingCategory === category ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileUp className="h-4 w-4" />
                    )}
                    Cargar
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
                </div>

                <div className="mt-3 space-y-1">
                  {files
                    .filter((file) => file.category === category)
                    .map((file) => (
                      <p key={file.id} className="text-xs text-slate-600">
                        {file.originalFilename} · {fileSizeLabel(file.byteSize)}
                      </p>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          complete={completedSections.includes("contact")}
          index={5}
          title="Contacto"
        >
          <p className="text-sm leading-6 text-slate-600">
            Esta será la persona con quien confirmaremos cualquier duda durante
            la configuración.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-slate-800">Nombre</span>
              <input
                disabled={!editable}
                value={draft.contactName ?? ""}
                onBlur={() => void save()}
                onChange={(event) =>
                  updateDraft({ contactName: event.currentTarget.value })
                }
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Teléfono</span>
              <input
                disabled={!editable}
                value={draft.contactPhone ?? ""}
                onBlur={() => void save()}
                onChange={(event) =>
                  updateDraft({ contactPhone: event.currentTarget.value })
                }
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">
                Correo electrónico
              </span>
              <input
                disabled={!editable}
                type="email"
                value={draft.contactEmail ?? ""}
                onBlur={() => void save()}
                onChange={(event) =>
                  updateDraft({ contactEmail: event.currentTarget.value })
                }
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-violet-600"
              />
            </label>
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
