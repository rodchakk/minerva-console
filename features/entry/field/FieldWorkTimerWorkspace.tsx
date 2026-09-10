"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clipboard,
  Loader2,
  PlayCircle,
  Square,
  TimerReset,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  cancelFieldWorkSession,
  startFieldWorkSession,
  stopFieldWorkSession,
  type FieldWorkTimerActionResult,
} from "@/features/entry/field/workTimerActions";
import {
  FIELD_WORK_CLASSIFICATIONS,
  FIELD_WORK_LOCATIONS,
  FIELD_WORK_TARGET_SCOPES,
  formatFieldWorkClock,
  formatFieldWorkDuration,
  getFieldWorkClassificationLabel,
  getFieldWorkElapsedSeconds,
  getFieldWorkLocationLabel,
  getFieldWorkTargetLabel,
  type FieldWorkClassification,
  type FieldWorkLocation,
  type FieldWorkTargetScope,
  type FieldWorkTargetSummary,
} from "@/features/entry/field/workTimerModel";
import type { FieldWorkTimerPageData } from "@/features/entry/field/workTimerData";

type FieldWorkTimerWorkspaceProps = {
  data: FieldWorkTimerPageData;
  isReadOnlyPreview: boolean;
};

function getResultMessage(result: FieldWorkTimerActionResult, fallback: string) {
  return result.success ? fallback : result.error || "Timer action failed.";
}

function useElapsedSeconds(startedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  return useMemo(() => {
    if (!startedAt) return 0;
    const started = new Date(startedAt).getTime();
    if (!Number.isFinite(started)) return 0;
    return Math.max(0, Math.floor((now - started) / 1000));
  }, [now, startedAt]);
}

function ChoiceButton({
  active,
  children,
  disabled,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        "min-h-11 rounded-lg border px-3 text-sm font-bold transition-colors disabled:opacity-50",
        active
          ? "border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] text-[var(--console-text)]"
          : "border-[var(--console-border)] bg-white/[0.03] text-[var(--console-text-muted)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SummaryGroup({
  emptyLabel,
  items,
  title,
}: {
  emptyLabel: string;
  items: Array<{ id: string; label: string; seconds: number }>;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
      <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
        {title}
      </h2>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-semibold text-[var(--console-text)]">
                {item.label}
              </span>
              <span className="shrink-0 text-sm font-bold text-[var(--console-text-muted)]">
                {formatFieldWorkDuration(item.seconds)}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--console-text-muted)]">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}

function TargetSummaryGroup({ items }: { items: FieldWorkTargetSummary[] }) {
  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
      <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
        Seshat grouping
      </h2>
      <div className="mt-3 space-y-4">
        {items.length > 0 ? (
          items.map((target) => (
            <article key={target.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 truncate text-sm font-bold text-[var(--console-text)]">
                  {target.label}
                </h3>
                <span className="shrink-0 text-sm font-black text-[var(--console-text)]">
                  {formatFieldWorkDuration(target.seconds)}
                </span>
              </div>
              <div className="space-y-1">
                {target.lines.map((line) => (
                  <div
                    key={`${target.id}-${line.id}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-[var(--console-text-muted)]">
                      {line.label}
                    </span>
                    <span className="shrink-0 font-semibold text-[var(--console-text-muted)]">
                      {formatFieldWorkDuration(line.seconds)}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm text-[var(--console-text-muted)]">
            No completed sessions.
          </p>
        )}
      </div>
    </section>
  );
}

export function FieldWorkTimerWorkspace({
  data,
  isReadOnlyPreview,
}: FieldWorkTimerWorkspaceProps) {
  const router = useRouter();
  const [targetScope, setTargetScope] =
    useState<FieldWorkTargetScope>("PRODUCT");
  const [classification, setClassification] =
    useState<FieldWorkClassification>("ONBOARDING");
  const [workLocation, setWorkLocation] = useState<FieldWorkLocation>("onsite");
  const [communityId, setCommunityId] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(data.error);
  const [copied, setCopied] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isPending, startTransition] = useTransition();
  const activeElapsedSeconds = useElapsedSeconds(
    data.activeSession?.startedAt ?? null,
  );
  const activeDuration = data.activeSession ? activeElapsedSeconds : 0;
  const hasClientTargetGap = targetScope === "CLIENT" && !communityId;
  const formDisabled = isPending || isReadOnlyPreview || !!data.activeSession;
  const startDisabled = formDisabled || hasClientTargetGap;

  function handleStart() {
    if (startDisabled) return;
    setNotice(null);
    startTransition(async () => {
      const result = await startFieldWorkSession({
        classification,
        communityId: targetScope === "CLIENT" ? communityId : null,
        notes,
        targetScope,
        workLocation,
      });
      setNotice(getResultMessage(result, "Timer started."));
      if (result.success) {
        setNotes("");
        router.refresh();
      }
    });
  }

  function handleStop() {
    const activeSession = data.activeSession;
    if (isPending || isReadOnlyPreview || !activeSession) return;
    setNotice(null);
    startTransition(async () => {
      const result = await stopFieldWorkSession({
        sessionId: activeSession.id,
      });
      setNotice(getResultMessage(result, "Timer stopped."));
      setConfirmingCancel(false);
      if (result.success) router.refresh();
    });
  }

  function handleCancel() {
    const activeSession = data.activeSession;
    if (isPending || isReadOnlyPreview || !activeSession) return;

    if (!confirmingCancel) {
      setConfirmingCancel(true);
      setNotice("Press Confirm cancel to cancel this active session.");
      return;
    }

    setNotice(null);
    startTransition(async () => {
      const result = await cancelFieldWorkSession({
        sessionId: activeSession.id,
      });
      setNotice(getResultMessage(result, "Timer cancelled."));
      setConfirmingCancel(false);
      if (result.success) router.refresh();
    });
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(data.copySummary);
      setCopied(true);
      setNotice("Summary copied for manual Seshat entry.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice("Could not copy summary from this browser.");
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href="/field/entry"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        ENTRY
      </Link>

      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          ENTRY Field
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--console-text)]">
              Work timer
            </h1>
            <p className="mt-1 text-sm leading-5 text-[var(--console-text-muted)]">
              Capture staff work time for ENTRY labor.
            </p>
          </div>
          <span className="rounded-full border border-[var(--console-border)] bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-[var(--console-text-muted)]">
            {data.month}
          </span>
        </div>
      </section>

      {notice ? (
        <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.04] px-4 py-3 text-sm leading-5 text-[var(--console-text-muted)]">
          {notice}
        </p>
      ) : null}

      {isReadOnlyPreview ? (
        <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">
          Preview is read-only. Timer writes are disabled.
        </p>
      ) : null}

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--console-text-soft)]">
              Current session
            </p>
            <p className="mt-2 text-4xl font-semibold text-[var(--console-text)] tabular-nums">
              {formatFieldWorkClock(activeDuration)}
            </p>
          </div>
          <TimerReset
            aria-hidden="true"
            className="h-8 w-8 text-[var(--console-accent)]"
          />
        </div>

        {data.activeSession ? (
          <div className="mt-4 rounded-lg border border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] p-3">
            <p className="text-sm font-bold text-[var(--console-text)]">
              {getFieldWorkTargetLabel(data.activeSession)}
            </p>
            <p className="mt-1 text-sm text-[var(--console-text-muted)]">
              {getFieldWorkClassificationLabel(data.activeSession.classification)} -{" "}
              {getFieldWorkLocationLabel(data.activeSession.workLocation)}
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-[var(--console-text)]">
                Target
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {FIELD_WORK_TARGET_SCOPES.map((item) => (
                  <ChoiceButton
                    key={item.id}
                    active={targetScope === item.id}
                    disabled={formDisabled}
                    onClick={() => {
                      setTargetScope(item.id);
                      if (item.id === "PRODUCT") setCommunityId("");
                    }}
                  >
                    {item.label}
                  </ChoiceButton>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="field-work-community"
                className="text-sm font-semibold text-[var(--console-text)]"
              >
                Client community
              </label>
              <select
                id="field-work-community"
                value={communityId}
                disabled={formDisabled || targetScope === "PRODUCT"}
                onChange={(event) => setCommunityId(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent-border)] disabled:opacity-50"
              >
                <option value="">Choose community</option>
                {data.communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="block" htmlFor="field-work-classification">
              <span className="text-sm font-semibold text-[var(--console-text)]">
                Classification
              </span>
              <select
                id="field-work-classification"
                value={classification}
                disabled={formDisabled}
                onChange={(event) =>
                  setClassification(event.target.value as FieldWorkClassification)
                }
                className="mt-2 min-h-11 w-full rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-3 text-base font-semibold text-[var(--console-text)] outline-none focus:border-[var(--console-accent-border)] disabled:opacity-50"
              >
                {FIELD_WORK_CLASSIFICATIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="text-sm font-semibold text-[var(--console-text)]">
                Location
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {FIELD_WORK_LOCATIONS.map((item) => (
                  <ChoiceButton
                    key={item.id}
                    active={workLocation === item.id}
                    disabled={formDisabled}
                    onClick={() => setWorkLocation(item.id)}
                  >
                    {item.label}
                  </ChoiceButton>
                ))}
              </div>
            </div>

            <label className="block" htmlFor="field-work-notes">
              <span className="text-sm font-semibold text-[var(--console-text)]">
                Notes
              </span>
              <textarea
                id="field-work-notes"
                value={notes}
                maxLength={2000}
                rows={3}
                disabled={formDisabled}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional context for the work session"
                className="mt-2 min-h-24 w-full resize-y rounded-lg border border-[var(--console-border)] bg-black/20 px-3 py-3 text-base leading-6 text-[var(--console-text)] outline-none placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)] disabled:opacity-50"
              />
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={data.activeSession ? handleStop : handleStart}
          disabled={isPending || isReadOnlyPreview || (!data.activeSession && startDisabled)}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-black text-white transition-opacity disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
          ) : data.activeSession ? (
            <Square aria-hidden="true" className="h-5 w-5" />
          ) : (
            <PlayCircle aria-hidden="true" className="h-5 w-5" />
          )}
          {data.activeSession ? "Stop timer" : "Start timer"}
        </button>

        {data.activeSession ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending || isReadOnlyPreview}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-4 text-sm font-black text-[var(--console-text-muted)] transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          >
            <XCircle aria-hidden="true" className="h-5 w-5" />
            {confirmingCancel ? "Confirm cancel" : "Cancel session"}
          </button>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
            Month total
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--console-text)]">
            {formatFieldWorkDuration(data.summary.totalSeconds)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
            Sessions
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--console-text)]">
            {data.summary.completedSessions}
          </p>
        </div>
      </section>

      <nav className="grid grid-cols-2 gap-2" aria-label="Timer month navigation">
        <Link
          href={`/field/entry/work-timer?month=${data.previousMonth}`}
          className="flex min-h-11 items-center justify-center rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 text-sm font-bold text-[var(--console-text)]"
        >
          Previous
        </Link>
        <Link
          href={`/field/entry/work-timer?month=${data.nextMonth}`}
          className="flex min-h-11 items-center justify-center rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 text-sm font-bold text-[var(--console-text)]"
        >
          Next
        </Link>
      </nav>

      <TargetSummaryGroup items={data.summary.byTarget} />

      <div className="grid gap-3 md:grid-cols-2">
        <SummaryGroup
          title="Classification"
          items={data.summary.byClassification}
          emptyLabel="No completed sessions."
        />
        <SummaryGroup
          title="Location"
          items={data.summary.byLocation}
          emptyLabel="No location totals."
        />
      </div>

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--console-text-soft)]">
              Monthly summary
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--console-text)]">
              Manual Seshat entry
            </h2>
          </div>
          <button
            type="button"
            onClick={copySummary}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/[0.05] px-3 text-xs font-black text-[var(--console-text)]"
          >
            <Clipboard aria-hidden="true" className="h-4 w-4" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--console-border)] bg-black/20 p-3 text-xs leading-5 text-[var(--console-text-muted)]">
          {data.copySummary}
        </pre>
      </section>

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--console-text-soft)]">
            History
          </p>
          <span className="text-xs font-semibold text-[var(--console-text-muted)]">
            {data.summarySessionCount} loaded
          </span>
        </div>
        {data.historyTruncated ? (
          <p className="mt-2 text-xs text-[var(--console-text-muted)]">
            Showing latest {data.historyLimit}; summary includes all loaded month sessions.
          </p>
        ) : null}
        <div className="mt-3 space-y-2">
          {data.sessions.length > 0 ? (
            data.sessions.map((session) => {
              const durationLabel =
                session.status === "CANCELLED"
                  ? "Cancelled"
                  : session.status === "ACTIVE"
                    ? "Active"
                    : formatFieldWorkDuration(getFieldWorkElapsedSeconds(session));

              return (
                <article
                  key={session.id}
                  className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--console-text)]">
                        {getFieldWorkTargetLabel(session)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                        {getFieldWorkClassificationLabel(session.classification)} -{" "}
                        {getFieldWorkLocationLabel(session.workLocation)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-[var(--console-text)]">
                      {durationLabel}
                    </span>
                  </div>
                  {session.notes ? (
                    <p className="mt-2 text-sm leading-5 text-[var(--console-text-muted)]">
                      {session.notes}
                    </p>
                  ) : null}
                </article>
              );
            })
          ) : (
            <p className="text-sm text-[var(--console-text-muted)]">
              No sessions recorded for this month.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
