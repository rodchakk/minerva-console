"use client";

import Link from "next/link";
import { Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  formatFieldWorkClock,
  type FieldActiveWorkTimer,
} from "@/features/entry/field/workTimerModel";

type FieldActiveWorkTimerIndicatorProps = {
  session: FieldActiveWorkTimer | null;
};

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

export function FieldActiveWorkTimerIndicator({
  session,
}: FieldActiveWorkTimerIndicatorProps) {
  const elapsedSeconds = useElapsedSeconds(session?.startedAt ?? null);
  const active = Boolean(session);

  return (
    <Link
      href="/field/entry/work-timer"
      aria-label={active ? "Open active ENTRY work timer" : "Open ENTRY work timer"}
      title={active && session ? `Work timer · ${session.communityName}` : "Work timer"}
      className={[
        "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold transition-colors",
        active
          ? "border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] text-[var(--console-text)] hover:bg-white/10"
          : "border-[var(--console-border)] bg-white/[0.03] text-[var(--console-text-muted)] hover:border-[var(--console-accent-border)] hover:text-[var(--console-text)]",
      ].join(" ")}
    >
      {active ? (
        <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
          <span className="absolute h-2.5 w-2.5 rounded-full bg-[var(--console-accent)] opacity-30" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--console-accent)]" />
        </span>
      ) : null}
      <Timer aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="shrink-0 tabular-nums">
        {active ? formatFieldWorkClock(elapsedSeconds) : "Timer"}
      </span>
    </Link>
  );
}
