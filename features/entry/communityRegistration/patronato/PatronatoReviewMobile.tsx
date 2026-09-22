"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Home,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  approvePatronatoUnits,
  holdPatronatoUnits,
} from "@/features/entry/communityRegistration/patronato/actions";
import type {
  PatronatoReviewSession,
  PatronatoReviewState,
} from "@/features/entry/communityRegistration/patronato/gateway";

type Filter = "all" | PatronatoReviewState;

function stateLabel(state: PatronatoReviewState) {
  switch (state) {
    case "hold":
      return "En espera";
    case "approved":
      return "Aprobada";
    case "processed":
      return "En activación";
    default:
      return "Lista para revisión";
  }
}

function stateClass(state: PatronatoReviewState) {
  switch (state) {
    case "hold":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "approved":
    case "processed":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    default:
      return "bg-blue-50 text-blue-700 ring-blue-200";
  }
}

export function PatronatoReviewMobile({
  previewReadOnly,
  session,
  token,
}: {
  previewReadOnly: boolean;
  session: PatronatoReviewSession;
  token: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<
    { tone: "error" | "success"; text: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  const normalizedSearch = search.trim().toLocaleLowerCase("es-HN");
  const units = useMemo(
    () =>
      session.units.filter((unit) => {
        if (filter !== "all" && unit.reviewState !== filter) return false;
        if (!normalizedSearch) return true;

        return [
          unit.label,
          unit.reference,
          ...unit.residents.map((resident) => resident.fullName),
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("es-HN")
          .includes(normalizedSearch);
      }),
    [filter, normalizedSearch, session.units],
  );

  const selectedSet = new Set(selectedIds);
  const actionableSelection = selectedIds.filter((id) => {
    const unit = session.units.find((item) => item.id === id);
    return unit?.reviewState === "pending" || unit?.reviewState === "hold";
  });

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function runDecision(decision: "approve" | "hold") {
    if (actionableSelection.length === 0 || previewReadOnly) return;

    setFeedback(null);
    startTransition(async () => {
      const result =
        decision === "approve"
          ? await approvePatronatoUnits({
              campaignId: session.campaignId,
              token,
              unitIds: actionableSelection,
            })
          : await holdPatronatoUnits({
              campaignId: session.campaignId,
              token,
              unitIds: actionableSelection,
            });

      if (!result.success) {
        setFeedback({ tone: "error", text: result.error });
        return;
      }

      setFeedback({ tone: "success", text: result.message });
      setSelectedIds([]);
      router.refresh();
    });
  }

  const approvedTotal = session.summary.approved + session.summary.processed;

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-950">
      <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-5 sm:px-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-blue-700">
                <span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-sm font-black text-white">
                  E
                </span>
                <div>
                  <p className="text-base font-black leading-none tracking-tight">
                    ENTRY
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    por Minerva
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-500">
                {session.communityName}
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                Revisión del Patronato
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Revise las viviendas preparadas por Minerva y apruebe únicamente
                las que estén autorizadas para activación.
              </p>
            </div>
            <ShieldCheck className="mt-1 size-7 shrink-0 text-blue-600" aria-hidden />
          </div>

          {previewReadOnly ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">
              Preview de revisión · solo lectura. Puede probar toda la interfaz,
              pero las decisiones están deshabilitadas.
            </div>
          ) : null}
        </header>

        <section className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-left"
          >
            <Clock3 className="size-4 text-amber-600" aria-hidden />
            <p className="mt-2 text-[11px] font-semibold text-amber-800">Pendientes</p>
            <p className="mt-0.5 text-2xl font-black text-amber-950">
              {session.summary.pending}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFilter("approved")}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-left"
          >
            <Check className="size-4 text-emerald-600" aria-hidden />
            <p className="mt-2 text-[11px] font-semibold text-emerald-800">Aprobadas</p>
            <p className="mt-0.5 text-2xl font-black text-emerald-950">
              {approvedTotal}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFilter("hold")}
            className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-left"
          >
            <Clock3 className="size-4 text-blue-600" aria-hidden />
            <p className="mt-2 text-[11px] font-semibold text-blue-800">En espera</p>
            <p className="mt-0.5 text-2xl font-black text-blue-950">
              {session.summary.hold}
            </p>
          </button>
        </section>

        <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <label className="relative block">
            <span className="sr-only">Buscar vivienda o residente</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar casa o residente..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </label>
          <div className="mt-2 flex gap-1 overflow-x-auto">
            {([
              ["all", "Todas"],
              ["pending", "Pendientes"],
              ["approved", "Aprobadas"],
              ["hold", "En espera"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  filter === value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {feedback ? (
          <p
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {feedback.text}
          </p>
        ) : null}

        <section className="mt-4 space-y-3">
          {units.map((unit) => {
            const actionable =
              unit.reviewState === "pending" || unit.reviewState === "hold";
            const expanded = expandedIds.includes(unit.id);
            const primary =
              unit.residents.find((resident) => resident.isPrimary) ??
              unit.residents[0] ??
              null;

            return (
              <article
                key={unit.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      aria-label={`Seleccionar ${unit.label}`}
                      disabled={!actionable}
                      onClick={() => toggleSelection(unit.id)}
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition ${
                        selectedSet.has(unit.id)
                          ? "border-blue-600 bg-blue-600 text-white"
                          : actionable
                            ? "border-slate-300 bg-white text-transparent"
                            : "border-slate-200 bg-slate-100 text-transparent"
                      }`}
                    >
                      <Check className="size-4" aria-hidden />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-500">Casa</p>
                          <h2 className="text-2xl font-black leading-none text-slate-950">
                            {unit.label}
                          </h2>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${stateClass(
                            unit.reviewState,
                          )}`}
                        >
                          {stateLabel(unit.reviewState)}
                        </span>
                      </div>

                      <p className="mt-3 text-base font-semibold text-slate-800">
                        {primary?.fullName ?? "Sin titular identificado"}
                      </p>
                      {unit.reference ? (
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {unit.reference}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleExpanded(unit.id)}
                    className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <Users className="size-4 text-blue-600" aria-hidden />
                      Habitantes de la unidad ({unit.residentCount})
                    </span>
                    {expanded ? (
                      <ChevronUp className="size-4" aria-hidden />
                    ) : (
                      <ChevronDown className="size-4" aria-hidden />
                    )}
                  </button>
                </div>

                {expanded ? (
                  <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3">
                    <div className="space-y-2">
                      {unit.residents.map((resident) => (
                        <div
                          key={`${unit.id}-${resident.position}`}
                          className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                              {resident.fullName
                                .split(" ")
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0]?.toUpperCase())
                                .join("")}
                            </span>
                            <span className="truncate text-sm font-semibold text-slate-800">
                              {resident.fullName}
                            </span>
                          </div>
                          {resident.isPrimary ? (
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                              Titular
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400">
                              Residente
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}

          {units.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
              <Home className="mx-auto size-7 text-slate-400" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No hay viviendas en esta vista.
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Las viviendas aparecen aquí únicamente cuando Minerva termina su
                revisión interna.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      {selectedIds.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_35px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
            <div className="min-w-20">
              <p className="text-xs font-semibold text-slate-500">Seleccionadas</p>
              <p className="text-lg font-black text-slate-950">{selectedIds.length}</p>
            </div>
            <button
              type="button"
              disabled={pending || previewReadOnly}
              onClick={() => runDecision("approve")}
              className="h-11 flex-1 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              {pending ? "Guardando..." : "Aprobar"}
            </button>
            <button
              type="button"
              disabled={pending || previewReadOnly}
              onClick={() => runDecision("hold")}
              className="h-11 flex-1 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700 transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              En espera
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
