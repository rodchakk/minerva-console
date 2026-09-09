"use client";

import {
  CalendarDays,
  Check,
  Clipboard,
  ClipboardCheck,
  Play,
  Square,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  cancelFieldWorkTimer,
  startFieldWorkTimer,
  stopFieldWorkTimer,
} from "@/features/entry/field/workTimerActions";
import {
  FIELD_WORK_ACTIVITY_OPTIONS,
  FIELD_WORK_MODE_OPTIONS,
  FIELD_WORK_TARGET_OPTIONS,
  buildFieldWorkSummaryText,
  formatTimerDuration,
  formatWorkDuration,
  getElapsedSeconds,
  getFieldWorkActivityLabel,
  getFieldWorkModeLabel,
  getFieldWorkTargetLabel,
  type FieldWorkCommunityOption,
  type FieldWorkMonthlySummary,
  type FieldWorkSession,
  type FieldWorkTargetScope,
} from "@/features/entry/field/workTimerModel";

type FieldWorkTimerClientProps = {
  activeSession: FieldWorkSession | null;
  communities: FieldWorkCommunityOption[];
  communityLoadState: "ready" | "unavailable";
  generatedAtIso: string;
  monthKey: string;
  recentSessions: FieldWorkSession[];
  status?: string;
  summary: FieldWorkMonthlySummary;
};

const controlClass =
  "min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent-border)] focus:ring-4 focus:ring-white/5";
const labelClass =
  "text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-soft)]";

function StatusMessage({ status }: { status?: string }) {
  if (!status) return null;

  const messages: Record<string, string> = {
    cancelled: "Registro cancelado. No contara en el resumen.",
    preview: "PREVIEW READ ONLY: los registros de tiempo estan bloqueados.",
    start: "No se pudo iniciar el cronometro. Revisa el destino.",
    started: "Cronometro iniciado.",
    stop: "No se pudo finalizar el registro.",
    stopped: "Trabajo registrado.",
  };
  const message = messages[status];
  if (!message) return null;

  return (
    <div className="rounded-lg border border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] px-4 py-3 text-sm font-semibold text-[var(--console-text)]">
      {message}
    </div>
  );
}

function ActiveTimerPanel({
  generatedAtIso,
  session,
}: {
  generatedAtIso: string;
  session: FieldWorkSession;
}) {
  const [now, setNow] = useState(() => new Date(generatedAtIso));

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const elapsedSeconds = getElapsedSeconds(session.startedAt, now);

  return (
    <section className="rounded-lg border border-[var(--console-accent-border)] bg-[var(--console-surface)] p-4">
      <div className="flex items-center gap-2 text-[var(--console-accent)]">
        <Timer aria-hidden="true" className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em]">
          ENTRY
        </p>
      </div>
      <h2 className="mt-4 text-2xl font-semibold text-[var(--console-text)]">
        {getFieldWorkTargetLabel(session)}
      </h2>
      <p className="mt-1 text-sm font-semibold text-[var(--console-text-muted)]">
        {getFieldWorkActivityLabel(session.activityCategory)} /{" "}
        {getFieldWorkModeLabel(session.workMode)}
      </p>
      <p className="mt-5 font-mono text-5xl font-semibold tracking-normal text-[var(--console-text)]">
        {formatTimerDuration(elapsedSeconds)}
      </p>
      {session.note ? (
        <p className="mt-4 rounded-lg bg-white/[0.03] px-3 py-2 text-sm leading-6 text-[var(--console-text-muted)]">
          {session.note}
        </p>
      ) : null}
      <div className="mt-5 grid gap-2">
        <form
          action={stopFieldWorkTimer}
          onSubmit={(event) => {
            if (!window.confirm("Finalizar este registro de trabajo?")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <button
            type="submit"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[var(--console-accent-hover)]"
          >
            <Square aria-hidden="true" className="h-4 w-4" />
            Finalizar
          </button>
        </form>
        <form
          action={cancelFieldWorkTimer}
          onSubmit={(event) => {
            if (!window.confirm("Cancelar este registro? No contara en resumen.")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <button
            type="submit"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-[var(--console-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--console-text)]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Cancelar registro
          </button>
        </form>
      </div>
    </section>
  );
}

function StartTimerForm({
  communities,
  communityLoadState,
}: {
  communities: FieldWorkCommunityOption[];
  communityLoadState: "ready" | "unavailable";
}) {
  const [targetScope, setTargetScope] =
    useState<FieldWorkTargetScope>("CLIENT");
  const [activityCategory, setActivityCategory] = useState("ONBOARDING");
  const needsCommunity = targetScope === "CLIENT";

  function chooseTarget(nextTargetScope: FieldWorkTargetScope) {
    setTargetScope(nextTargetScope);
    setActivityCategory((current) => {
      if (
        nextTargetScope === "PRODUCT" &&
        (current === "ONBOARDING" || current === "SUPPORT")
      ) {
        return "PRODUCT_MAINTENANCE";
      }
      if (
        nextTargetScope === "CLIENT" &&
        (current === "PRODUCT_MAINTENANCE" ||
          current === "PRODUCT_DEVELOPMENT_RND")
      ) {
        return "ONBOARDING";
      }
      return current;
    });
  }

  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
        Tiempo de trabajo
      </p>
      <p className="mt-4 font-mono text-5xl font-semibold tracking-normal text-[var(--console-text)]">
        00:00:00
      </p>

      <form action={startFieldWorkTimer} className="mt-5 space-y-4">
        <div>
          <p className={labelClass}>Destino</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {FIELD_WORK_TARGET_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={[
                  "flex min-h-12 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors",
                  targetScope === option.value
                    ? "border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] text-[var(--console-text)]"
                    : "border-[var(--console-border)] bg-white/[0.03] text-[var(--console-text-muted)]",
                ].join(" ")}
              >
                <input
                  className="sr-only"
                  name="targetScope"
                  type="radio"
                  value={option.value}
                  checked={targetScope === option.value}
                  onChange={() => chooseTarget(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        {needsCommunity ? (
          <label className="block">
            <span className={labelClass}>Comunidad</span>
            <select
              className={`${controlClass} mt-2`}
              disabled={communityLoadState !== "ready" || communities.length === 0}
              name="communityId"
              required
            >
              <option value="">Seleccionar comunidad</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                  {community.city ? ` / ${community.city}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {communityLoadState === "unavailable" && needsCommunity ? (
          <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm leading-5 text-amber-100">
            Las comunidades no cargaron. Usa ENTRY general o intenta de nuevo.
          </p>
        ) : null}

        <label className="block">
          <span className={labelClass}>Actividad</span>
          <select
            className={`${controlClass} mt-2`}
            name="activityCategory"
            value={activityCategory}
            onChange={(event) => setActivityCategory(event.target.value)}
            required
          >
            {FIELD_WORK_ACTIVITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className={labelClass}>Modalidad</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {FIELD_WORK_MODE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex min-h-12 items-center justify-center rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 text-sm font-semibold text-[var(--console-text-muted)] has-[:checked]:border-[var(--console-accent-border)] has-[:checked]:bg-[var(--console-accent-subtle)] has-[:checked]:text-[var(--console-text)]"
              >
                <input
                  className="sr-only"
                  name="workMode"
                  type="radio"
                  value={option.value}
                  defaultChecked={option.value === "ONSITE"}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <label className="block">
          <span className={labelClass}>Nota opcional</span>
          <textarea
            className={`${controlClass} mt-2 min-h-24 py-3`}
            maxLength={500}
            name="note"
            placeholder="Detalle corto"
          />
        </label>

        <button
          type="submit"
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[var(--console-accent-hover)] disabled:bg-slate-500"
          disabled={
            needsCommunity &&
            (communityLoadState !== "ready" || communities.length === 0)
          }
        >
          <Play aria-hidden="true" className="h-4 w-4" />
          Iniciar cronometro
        </button>
      </form>
    </section>
  );
}

function CompletionCard({ session }: { session: FieldWorkSession | null }) {
  if (!session) return null;

  return (
    <section className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4">
      <div className="flex items-center gap-2 text-emerald-100">
        <Check aria-hidden="true" className="h-4 w-4" />
        <p className="text-sm font-semibold">Trabajo registrado</p>
      </div>
      <p className="mt-3 text-xl font-semibold text-[var(--console-text)]">
        {getFieldWorkTargetLabel(session)}
      </p>
      <p className="mt-1 text-sm text-emerald-100/85">
        {getFieldWorkActivityLabel(session.activityCategory)} /{" "}
        {getFieldWorkModeLabel(session.workMode)}
      </p>
      <p className="mt-3 font-mono text-2xl font-semibold text-[var(--console-text)]">
        {formatWorkDuration(session.durationSeconds)}
      </p>
    </section>
  );
}

function RecentHistory({ sessions }: { sessions: FieldWorkSession[] }) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          Historial
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--console-text)]">
          Registros recientes
        </h2>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 text-sm leading-6 text-[var(--console-text-muted)]">
          No hay trabajo completado todavia.
        </div>
      ) : (
        <div className="grid gap-2.5">
          {sessions.map((session) => (
            <article
              key={session.id}
              className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--console-text)]">
                    {getFieldWorkTargetLabel(session)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--console-text-muted)]">
                    {getFieldWorkActivityLabel(session.activityCategory)} /{" "}
                    {getFieldWorkModeLabel(session.workMode)}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-lg font-semibold text-[var(--console-text)]">
                  {formatWorkDuration(session.durationSeconds)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MonthlySummary({
  monthKey,
  summary,
}: {
  monthKey: string;
  summary: FieldWorkMonthlySummary;
}) {
  const [copied, setCopied] = useState(false);
  const summaryText = useMemo(() => buildFieldWorkSummaryText(summary), [summary]);

  async function copySummary() {
    await navigator.clipboard.writeText(summaryText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
            Resumen mensual
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--console-text)]">
            {summary.monthTitle}
          </h2>
        </div>
        <form action="/field/entry/time" className="flex items-center gap-2">
          <label className="sr-only" htmlFor="field-work-month">
            Mes
          </label>
          <input
            className="min-h-10 rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 text-sm text-[var(--console-text)]"
            defaultValue={monthKey}
            id="field-work-month"
            name="month"
            type="month"
          />
          <button
            className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 text-sm font-semibold text-[var(--console-text)]"
            type="submit"
          >
            <CalendarDays aria-hidden="true" className="h-4 w-4" />
            Ver
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        {summary.sections.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--console-text-muted)]">
            Sin trabajo completado en este mes.
          </p>
        ) : (
          <div className="space-y-5">
            {summary.sections.map((section) => (
              <div key={section.targetKey}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="min-w-0 truncate text-lg font-semibold text-[var(--console-text)]">
                    {section.targetLabel}
                  </h3>
                  <p className="shrink-0 font-mono text-sm font-semibold text-[var(--console-text)]">
                    {formatWorkDuration(section.durationSeconds)}
                  </p>
                </div>
                <div className="mt-3 grid gap-2">
                  {section.lines.map((line) => (
                    <div
                      key={`${section.targetKey}-${line.activityCategory}-${line.workMode}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-[var(--console-text-muted)]">
                        {line.activityLabel} / {line.workModeLabel}
                      </span>
                      <span className="shrink-0 font-mono font-semibold text-[var(--console-text)]">
                        {formatWorkDuration(line.durationSeconds)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-4 text-sm font-bold uppercase tracking-[0.08em] text-[var(--console-text)] transition-colors hover:bg-white/[0.06]"
          onClick={copySummary}
          type="button"
        >
          {copied ? (
            <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Clipboard aria-hidden="true" className="h-4 w-4" />
          )}
          {copied ? "Resumen copiado" : "Copiar resumen"}
        </button>
      </div>
    </section>
  );
}

export function FieldWorkTimerClient({
  activeSession,
  communities,
  communityLoadState,
  generatedAtIso,
  monthKey,
  recentSessions,
  status,
  summary,
}: FieldWorkTimerClientProps) {
  const stoppedSession =
    status === "stopped" ? recentSessions[0] ?? null : null;

  return (
    <div className="space-y-5">
      <StatusMessage status={status} />
      <CompletionCard session={stoppedSession} />
      {activeSession ? (
        <ActiveTimerPanel
          generatedAtIso={generatedAtIso}
          session={activeSession}
        />
      ) : (
        <StartTimerForm
          communities={communities}
          communityLoadState={communityLoadState}
        />
      )}
      <RecentHistory sessions={recentSessions} />
      <MonthlySummary monthKey={monthKey} summary={summary} />
    </div>
  );
}
