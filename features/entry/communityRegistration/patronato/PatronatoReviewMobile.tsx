"use client";

import Image from "next/image";
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
  Sparkles,
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
      return "bg-sky-50 text-sky-700 ring-sky-200";
    case "approved":
    case "processed":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    default:
      return "bg-amber-50 text-amber-800 ring-amber-200";
  }
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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
  const [filter, setFilter] = useState<Filter>("pending");
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
        if (
          filter !== "all" &&
          !(
            filter === "approved" &&
            ["approved", "processed"].includes(unit.reviewState)
          ) &&
          unit.reviewState !== filter
        ) {
          return false;
        }
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
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-8">
        <div className="flex-1 pb-32">
          <header className="pt-1 sm:pt-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-3">
                  <span className="inline-flex rounded-full bg-[#efe7ff] px-4 py-1.5 text-xs font-bold uppercase text-[#4c1d95]">
                    ENTRY
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    por Minerva
                  </span>
                </div>
                <p className="mt-4 text-base font-semibold text-slate-500 sm:text-xl">
                  {session.communityName}
                </p>
                <h1 className="mt-1 text-3xl font-bold text-slate-950 sm:text-5xl">
                  Revisión del Patronato
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-6 text-slate-600 sm:leading-7">
                  Revise las viviendas preparadas por Minerva y apruebe únicamente
                  las que estén autorizadas para activación.
                </p>
              </div>
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[#ddd6fe] bg-white text-[#5b21b6] shadow-[0_8px_24px_rgba(91,33,182,0.10)] sm:size-14">
                <ShieldCheck className="size-6 sm:size-7" aria-hidden />
              </div>
            </div>

            {previewReadOnly ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900 shadow-sm">
                Preview de revisión · solo lectura. Puede probar toda la interfaz,
                pero las decisiones están deshabilitadas.
              </div>
            ) : null}
          </header>

          <section className="mt-5 grid grid-cols-3 gap-2 sm:mt-7 sm:gap-3">
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-left shadow-[0_8px_22px_rgba(217,119,6,0.06)] transition hover:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <span className="grid size-8 place-items-center rounded-xl bg-white/80 text-amber-600 ring-1 ring-amber-200">
                <Clock3 className="size-4" aria-hidden />
              </span>
              <p className="mt-2 text-[11px] font-semibold text-amber-800 sm:text-xs">
                Pendientes
              </p>
              <p className="mt-0.5 text-2xl font-black text-amber-950 sm:text-3xl">
                {session.summary.pending}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setFilter("approved")}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-left shadow-[0_8px_22px_rgba(5,150,105,0.06)] transition hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <span className="grid size-8 place-items-center rounded-xl bg-white/80 text-emerald-600 ring-1 ring-emerald-200">
                <Check className="size-4" aria-hidden />
              </span>
              <p className="mt-2 text-[11px] font-semibold text-emerald-800 sm:text-xs">
                Aprobadas
              </p>
              <p className="mt-0.5 text-2xl font-black text-emerald-950 sm:text-3xl">
                {approvedTotal}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setFilter("hold")}
              className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 text-left shadow-[0_8px_22px_rgba(2,132,199,0.06)] transition hover:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              <span className="grid size-8 place-items-center rounded-xl bg-white/80 text-sky-600 ring-1 ring-sky-200">
                <Clock3 className="size-4" aria-hidden />
              </span>
              <p className="mt-2 text-[11px] font-semibold text-sky-800 sm:text-xs">
                En espera
              </p>
              <p className="mt-0.5 text-2xl font-black text-sky-950 sm:text-3xl">
                {session.summary.hold}
              </p>
            </button>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
            <label className="relative block">
              <span className="sr-only">Buscar vivienda o residente</span>
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar casa o residente..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15"
              />
            </label>
            <div
              className="mt-2 grid grid-cols-[1.15fr_1.15fr_1fr_0.8fr] gap-1 sm:gap-1.5"
              aria-label="Filtros de revisión"
            >
              {([
                ["pending", "Pendientes"],
                ["approved", "Aprobadas"],
                ["hold", "En espera"],
                ["all", "Todas"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`min-w-0 rounded-xl px-0.5 py-2 text-[10px] font-bold leading-tight transition focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/25 sm:px-3.5 sm:text-xs ${
                    filter === value
                      ? "bg-[#5b21b6] text-white shadow-[0_8px_18px_rgba(91,33,182,0.18)]"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {feedback ? (
            <p
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                feedback.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {feedback.text}
            </p>
          ) : null}

          <section className="mt-4 space-y-3 sm:mt-5">
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
                  className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.05)]"
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        aria-label={`Seleccionar ${unit.label}`}
                        disabled={!actionable}
                        onClick={() => toggleSelection(unit.id)}
                        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/25 ${
                          selectedSet.has(unit.id)
                            ? "border-[#5b21b6] bg-[#5b21b6] text-white"
                            : actionable
                              ? "border-slate-300 bg-white text-transparent hover:border-[#7c3aed]"
                              : "border-slate-200 bg-slate-100 text-transparent"
                        }`}
                      >
                        <Check className="size-4" aria-hidden />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Casa
                            </p>
                            <h2 className="mt-0.5 break-words text-2xl font-black leading-none text-slate-950 sm:text-3xl">
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

                        <p className="mt-3 truncate text-base font-semibold text-slate-800">
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
                      className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/20"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Users
                          className="size-4 shrink-0 text-[#5b21b6]"
                          aria-hidden
                        />
                        <span className="truncate">
                          Habitantes de la unidad ({unit.residentCount})
                        </span>
                      </span>
                      {expanded ? (
                        <ChevronUp className="size-4 shrink-0" aria-hidden />
                      ) : (
                        <ChevronDown className="size-4 shrink-0" aria-hidden />
                      )}
                    </button>
                  </div>

                  {expanded ? (
                    <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-5">
                      <div className="space-y-2">
                        {unit.residents.map((resident) => (
                          <div
                            key={`${unit.id}-${resident.position}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#efe7ff] text-xs font-bold text-[#4c1d95]">
                                {initialsFor(resident.fullName)}
                              </span>
                              <span className="truncate text-sm font-semibold text-slate-800">
                                {resident.fullName}
                              </span>
                            </div>
                            {resident.isPrimary ? (
                              <span className="shrink-0 rounded-full bg-[#efe7ff] px-2 py-1 text-[10px] font-bold text-[#4c1d95]">
                                Titular
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
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
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
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

        <footer className="mt-6 border-t border-slate-200/80 pt-4 sm:mt-8">
          <div className="flex flex-col items-center gap-2">
            <Image
              alt="Minerva Technologies"
              className="h-auto w-40 opacity-75 sm:w-44"
              height={714}
              src="/brand/minerva-logo-gray.png"
              width={2129}
            />
            <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <ShieldCheck className="size-4" aria-hidden />
              Tus datos están protegidos
            </p>
          </div>
        </footer>
      </div>

      {selectedIds.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_35px_rgba(15,23,42,0.10)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
            <div className="min-w-20 rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-500">
                Seleccionadas
              </p>
              <p className="text-lg font-black leading-none text-slate-950">
                {selectedIds.length}
              </p>
            </div>
            <button
              type="button"
              disabled={pending || previewReadOnly}
              onClick={() => runDecision("approve")}
              className="h-11 flex-1 rounded-xl bg-[#5b21b6] px-3 text-sm font-bold text-white transition hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {pending ? "Guardando..." : "Aprobar"}
            </button>
            <button
              type="button"
              disabled={pending || previewReadOnly}
              onClick={() => runDecision("hold")}
              className="h-11 flex-1 rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-bold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              En espera
            </button>
          </div>
          {previewReadOnly ? (
            <p className="mx-auto mt-2 flex max-w-3xl items-center justify-center gap-1.5 text-xs font-semibold text-amber-700">
              <Sparkles className="size-3.5" aria-hidden />
              Preview de solo lectura
            </p>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
