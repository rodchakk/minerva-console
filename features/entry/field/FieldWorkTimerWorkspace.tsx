"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clipboard,
  Loader2,
  PauseCircle,
  PlayCircle,
  TimerReset,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  startFieldWorkSession,
  stopFieldWorkSession,
  type FieldWorkTimerActionResult,
} from "@/features/entry/field/workTimerActions";
import {
  FIELD_WORK_CLASSIFICATIONS,
  FIELD_WORK_LOCATIONS,
  formatFieldWorkDuration,
  getFieldWorkClassificationLabel,
  getFieldWorkElapsedSeconds,
  getFieldWorkLocationLabel,
  type FieldWorkClassification,
  type FieldWorkLocation,
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

export function FieldWorkTimerWorkspace({
  data,
  isReadOnlyPreview,
}: FieldWorkTimerWorkspaceProps) {
  const router = useRouter();
  const [classification, setClassification] =
    useState<FieldWorkClassification>("onboarding");
  const [workLocation, setWorkLocation] = useState<FieldWorkLocation>("onsite");
  const [communityId, setCommunityId] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(data.error);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const activeElapsedSeconds = useElapsedSeconds(
    data.activeSession?.startedAt ?? null,
  );
  const activeDuration = data.activeSession ? activeElapsedSeconds : 0;
  const controlsDisabled = isPending || isReadOnlyPreview || !!data.activeSession;

  function handleStart() {
    if (controlsDisabled) return;
    setNotice(null);
    startTransition(async () => {
      const result = await startFieldWorkSession({
        classification,
        communityId: communityId || null,
        notes,
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
              Capture staff work time for ENTRY communities.
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
            <p className="mt-2 text-4xl font-semibold text-[var(--console-text)]">
              {formatFieldWorkDuration(activeDuration)}
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
              {getFieldWorkClassificationLabel(data.activeSession.classification)} ·{" "}
              {getFieldWorkLocationLabel(data.activeSession.workLocation)}
            </p>
            <p className="mt-1 text-sm text-[var(--console-text-muted)]">
              {data.activeSession.communityName}
            </p>
            {data.activeSession.notes ? (
              <p className="mt-2 text-sm leading-5 text-[var(--console-text-muted)]">
                {data.activeSession.notes}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="field-work-community"
                className="text-sm font-semibold text-[var(--console-text)]"
              >
                Community
              </label>
              <select
                id="field-work-community"
                value={communityId}
                disabled={controlsDisabled}
                onChange={(event) => setCommunityId(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent-border)] disabled:opacity-50"
              >
                <option value="">ENTRY general</option>
                {data.communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-sm font-semibold text-[var(--console-text)]">
                Classification
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {FIELD_WORK_CLASSIFICATIONS.map((item) => (
                  <ChoiceButton
                    key={item.id}
                    active={classification === item.id}
                    disabled={controlsDisabled}
                    onClick={() => setClassification(item.id)}
                  >
                    {item.label}
                  </ChoiceButton>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-[var(--console-text)]">
                Location
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {FIELD_WORK_LOCATIONS.map((item) => (
                  <ChoiceButton
                    key={item.id}
                    active={workLocation === item.id}
                    disabled={controlsDisabled}
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
                disabled={controlsDisabled}
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
          disabled={
            isPending ||
            isReadOnlyPreview ||
            (!data.activeSession && controlsDisabled)
          }
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-black text-white transition-opacity disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
          ) : data.activeSession ? (
            <PauseCircle aria-hidden="true" className="h-5 w-5" />
          ) : (
            <PlayCircle aria-hidden="true" className="h-5 w-5" />
          )}
          {data.activeSession ? "Stop timer" : "Start timer"}
        </button>
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

      <div className="grid gap-3 md:grid-cols-3">
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
        <SummaryGroup
          title="Community"
          items={data.summary.byCommunity}
          emptyLabel="No community totals."
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
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--console-text-soft)]">
          History
        </p>
        <div className="mt-3 space-y-2">
          {data.sessions.length > 0 ? (
            data.sessions.map((session) => (
              <article
                key={session.id}
                className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--console-text)]">
                      {getFieldWorkClassificationLabel(session.classification)} ·{" "}
                      {getFieldWorkLocationLabel(session.workLocation)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                      {session.communityName}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-[var(--console-text)]">
                    {formatFieldWorkDuration(getFieldWorkElapsedSeconds(session))}
                  </span>
                </div>
                {session.notes ? (
                  <p className="mt-2 text-sm leading-5 text-[var(--console-text-muted)]">
                    {session.notes}
                  </p>
                ) : null}
              </article>
            ))
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
